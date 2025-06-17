const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router = express.Router();

const { getSupabase } = require('../config/database');
const logger = require('../utils/logger');
const {
  formatResponse,
  formatErrorResponse,
  addAuditEntry,
  paginate,
  formatPaginationMeta,
  coordinatesToPoint,
  pointToCoordinates,
  validateTags
} = require('../utils/helpers');
const { asyncHandler, validationErrorHandler } = require('../middleware/errorHandler');
const { requirePermission, requireOwnership } = require('../middleware/auth');
const { createDisasterLimiter } = require('../middleware/rateLimit');

// Validation rules
const createDisasterValidation = [
  body('title').notEmpty().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
  body('description').optional().isLength({ max: 2000 }).withMessage('Description must be less than 2000 characters'),
  body('location_name').optional().isLength({ max: 100 }).withMessage('Location name must be less than 100 characters'),
  body('tags').optional().isArray().custom(validateTags).withMessage('Invalid tags provided'),
  body('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude')
];

const updateDisasterValidation = [
  param('id').isUUID().withMessage('Invalid disaster ID'),
  body('title').optional().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
  body('description').optional().isLength({ max: 2000 }).withMessage('Description must be less than 2000 characters'),
  body('location_name').optional().isLength({ max: 100 }).withMessage('Location name must be less than 100 characters'),
  body('tags').optional().isArray().custom(validateTags).withMessage('Invalid tags provided'),
  body('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude')
];

const listDisastersValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  query('tag').optional().isString().withMessage('Tag must be a string'),
  query('owner_id').optional().isString().withMessage('Owner ID must be a string'),
  query('search').optional().isString().withMessage('Search must be a string')
];

/**
 * GET /api/disasters
 * List disasters with filtering and pagination
 */
router.get('/', listDisastersValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(validationErrorHandler(errors));
  }

  const { page = 1, limit = 10, tag, owner_id, search } = req.query;
  const { page: pageNum, limit: limitNum, offset } = paginate(page, limit);

  const supabase = getSupabase();
  let query = supabase.from('disasters').select('*', { count: 'exact' });

  // Apply filters
  if (tag) {
    query = query.contains('tags', [tag]);
  }

  if (owner_id) {
    query = query.eq('owner_id', owner_id);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,location_name.ilike.%${search}%`);
  }

  // Apply pagination and ordering
  query = query.range(offset, offset + limitNum - 1).order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    logger.error('Failed to fetch disasters:', error);
    return res.status(500).json(formatErrorResponse('Failed to fetch disasters', [error.message]));
  }

  // Convert PostGIS points to coordinates
  const disasters = data.map(disaster => ({
    ...disaster,
    coordinates: disaster.location ? pointToCoordinates(disaster.location) : null
  }));

  logger.info('Disasters fetched successfully', {
    userId: req.user.id,
    count: disasters.length,
    filters: { tag, owner_id, search },
    pagination: { page: pageNum, limit: limitNum }
  });

  res.json(formatResponse(true, {
    disasters,
    pagination: formatPaginationMeta(pageNum, limitNum, count)
  }, 'Disasters fetched successfully'));
}));

/**
 * GET /api/disasters/:id
 * Get a specific disaster by ID
 */
router.get('/:id', param('id').isUUID(), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(validationErrorHandler(errors));
  }

  const { id } = req.params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('disasters')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json(formatErrorResponse('Disaster not found', [], 404));
    }
    logger.error('Failed to fetch disaster:', error);
    return res.status(500).json(formatErrorResponse('Failed to fetch disaster', [error.message]));
  }

  // Convert PostGIS point to coordinates
  const disaster = {
    ...data,
    coordinates: data.location ? pointToCoordinates(data.location) : null
  };

  logger.info('Disaster fetched successfully', {
    userId: req.user.id,
    disasterId: id
  });

  res.json(formatResponse(true, disaster, 'Disaster fetched successfully'));
}));

/**
 * POST /api/disasters
 * Create a new disaster
 */
router.post('/',
  createDisasterLimiter,
  requirePermission('create'),
  createDisasterValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(validationErrorHandler(errors));
    }

    const { title, description, location_name, tags = [], lat, lng } = req.body;
    const supabase = getSupabase();

    // Prepare disaster data
    const disasterData = {
      title,
      description,
      location_name,
      tags,
      owner_id: req.user.id,
      audit_trail: addAuditEntry([], 'create', req.user.id, { title })
    };

    // Add location if coordinates provided
    if (lat && lng) {
      disasterData.location = coordinatesToPoint(lat, lng);
    }

    const { data, error } = await supabase
      .from('disasters')
      .insert(disasterData)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create disaster:', error);
      return res.status(500).json(formatErrorResponse('Failed to create disaster', [error.message]));
    }

    // Convert PostGIS point to coordinates
    const disaster = {
      ...data,
      coordinates: data.location ? pointToCoordinates(data.location) : null
    };

    logger.disasterAction('created', data.id, req.user.id, { title });

    // Emit WebSocket event
    req.io.emit('disaster_updated', {
      action: 'create',
      disaster,
      userId: req.user.id
    });

    res.status(201).json(formatResponse(true, disaster, 'Disaster created successfully'));
  })
);

/**
 * PUT /api/disasters/:id
 * Update a disaster
 */
router.put('/:id',
  requirePermission('update'),
  updateDisasterValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(validationErrorHandler(errors));
    }

    const { id } = req.params;
    const { title, description, location_name, tags, lat, lng } = req.body;
    const supabase = getSupabase();

    // First, get the existing disaster to check ownership
    const { data: existingDisaster, error: fetchError } = await supabase
      .from('disasters')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json(formatErrorResponse('Disaster not found', [], 404));
      }
      logger.error('Failed to fetch disaster for update:', fetchError);
      return res.status(500).json(formatErrorResponse('Failed to fetch disaster', [fetchError.message]));
    }

    // Check ownership
    req.resource = existingDisaster;
    const ownershipCheck = requireOwnership(req, res, () => { });
    if (ownershipCheck) return; // If ownership check failed, response already sent

    // Prepare update data
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (location_name !== undefined) updateData.location_name = location_name;
    if (tags !== undefined) updateData.tags = tags;

    // Update location if coordinates provided
    if (lat !== undefined && lng !== undefined) {
      updateData.location = coordinatesToPoint(lat, lng);
    }

    // Add audit trail entry
    updateData.audit_trail = addAuditEntry(
      existingDisaster.audit_trail || [],
      'update',
      req.user.id,
      { changes: Object.keys(updateData) }
    );

    const { data, error } = await supabase
      .from('disasters')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update disaster:', error);
      return res.status(500).json(formatErrorResponse('Failed to update disaster', [error.message]));
    }

    // Convert PostGIS point to coordinates
    const disaster = {
      ...data,
      coordinates: data.location ? pointToCoordinates(data.location) : null
    };

    logger.disasterAction('updated', id, req.user.id, { changes: Object.keys(updateData) });

    // Emit WebSocket event
    req.io.emit('disaster_updated', {
      action: 'update',
      disaster,
      userId: req.user.id
    });

    res.json(formatResponse(true, disaster, 'Disaster updated successfully'));
  })
);

/**
 * DELETE /api/disasters/:id
 * Delete a disaster
 */
router.delete('/:id',
  requirePermission('delete'),
  param('id').isUUID(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(validationErrorHandler(errors));
    }

    const { id } = req.params;
    const supabase = getSupabase();

    // First, get the existing disaster to check ownership
    const { data: existingDisaster, error: fetchError } = await supabase
      .from('disasters')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json(formatErrorResponse('Disaster not found', [], 404));
      }
      logger.error('Failed to fetch disaster for deletion:', fetchError);
      return res.status(500).json(formatErrorResponse('Failed to fetch disaster', [fetchError.message]));
    }

    // Check ownership
    req.resource = existingDisaster;
    const ownershipCheck = requireOwnership(req, res, () => { });
    if (ownershipCheck) return; // If ownership check failed, response already sent

    const { error } = await supabase
      .from('disasters')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Failed to delete disaster:', error);
      return res.status(500).json(formatErrorResponse('Failed to delete disaster', [error.message]));
    }

    logger.disasterAction('deleted', id, req.user.id, { title: existingDisaster.title });

    // Emit WebSocket event
    req.io.emit('disaster_updated', {
      action: 'delete',
      disasterId: id,
      userId: req.user.id
    });

    res.json(formatResponse(true, null, 'Disaster deleted successfully'));
  })
);

module.exports = router;
