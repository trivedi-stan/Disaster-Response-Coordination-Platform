const express = require('express');
const { param, query, validationResult } = require('express-validator');
const router = express.Router();

const { getSupabase } = require('../config/database');
const logger = require('../utils/logger');
const { formatResponse, formatErrorResponse, pointToCoordinates } = require('../utils/helpers');
const { asyncHandler, validationErrorHandler } = require('../middleware/errorHandler');
const { requirePermission } = require('../middleware/auth');

// Validation rules
const getResourcesValidation = [
  param('id').isUUID().withMessage('Invalid disaster ID'),
  query('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  query('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  query('radius').optional().isInt({ min: 1, max: 100 }).withMessage('Radius must be 1-100 km'),
  query('type').optional().isString().withMessage('Type must be a string'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100')
];

/**
 * GET /api/disasters/:id/resources
 * Get resources for a disaster with optional geospatial filtering
 */
router.get('/:id/resources',
  requirePermission('read'),
  getResourcesValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(validationErrorHandler(errors));
    }

    const { id: disasterId } = req.params;
    const { lat, lng, radius = 10, type, limit = 50 } = req.query;
    const supabase = getSupabase();

    try {
      // First, verify the disaster exists
      const { data: disaster, error: disasterError } = await supabase
        .from('disasters')
        .select('id, title, location')
        .eq('id', disasterId)
        .single();

      if (disasterError) {
        if (disasterError.code === 'PGRST116') {
          return res.status(404).json(formatErrorResponse('Disaster not found', [], 404));
        }
        throw disasterError;
      }

      let query = supabase
        .from('resources')
        .select('*')
        .eq('disaster_id', disasterId);

      // Apply type filter if provided
      if (type) {
        query = query.eq('type', type);
      }

      // Apply geospatial filtering if coordinates provided
      if (lat && lng) {
        const radiusMeters = parseFloat(radius) * 1000; // Convert km to meters
        
        // Use PostGIS ST_DWithin for geospatial query
        query = query.rpc('resources_within_radius', {
          center_lat: parseFloat(lat),
          center_lng: parseFloat(lng),
          radius_meters: radiusMeters,
          disaster_uuid: disasterId
        });

        logger.geospatialQuery('resources_within_radius', { lat, lng }, radius, 0, 0, {
          disasterId,
          type
        });
      } else if (disaster.location) {
        // Use disaster location as center if no coordinates provided
        const disasterCoords = pointToCoordinates(disaster.location);
        if (disasterCoords) {
          const radiusMeters = parseFloat(radius) * 1000;
          
          query = query.rpc('resources_within_radius', {
            center_lat: disasterCoords.lat,
            center_lng: disasterCoords.lng,
            radius_meters: radiusMeters,
            disaster_uuid: disasterId
          });

          logger.geospatialQuery('resources_within_radius', disasterCoords, radius, 0, 0, {
            disasterId,
            type,
            source: 'disaster_location'
          });
        }
      }

      // Apply ordering and limit
      query = query.order('created_at', { ascending: false }).limit(parseInt(limit));

      const startTime = Date.now();
      const { data: resources, error } = await query;
      const responseTime = Date.now() - startTime;

      if (error) {
        // If the RPC function doesn't exist, fall back to basic query
        if (error.code === 'PGRST202') {
          logger.warn('Geospatial RPC function not found, falling back to basic query');
          
          const { data: fallbackResources, error: fallbackError } = await supabase
            .from('resources')
            .select('*')
            .eq('disaster_id', disasterId)
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

          if (fallbackError) {
            throw fallbackError;
          }

          const processedResources = fallbackResources.map(resource => ({
            ...resource,
            coordinates: resource.location ? pointToCoordinates(resource.location) : null,
            distance_km: null // Can't calculate without geospatial function
          }));

          logger.info('Resources fetched (fallback)', {
            userId: req.user.id,
            disasterId,
            resourceCount: processedResources.length,
            responseTime
          });

          return res.json(formatResponse(true, {
            resources: processedResources,
            disaster: {
              id: disaster.id,
              title: disaster.title
            },
            filters: { type, radius, coordinates: lat && lng ? { lat, lng } : null },
            totalFound: processedResources.length,
            geospatial_query: false
          }, 'Resources fetched successfully (basic query)'));
        }
        
        throw error;
      }

      // Process resources to include coordinates
      const processedResources = resources.map(resource => ({
        ...resource,
        coordinates: resource.location ? pointToCoordinates(resource.location) : null
      }));

      logger.geospatialQuery('resources_query', { lat, lng }, radius, processedResources.length, responseTime, {
        disasterId,
        type
      });

      logger.info('Resources fetched successfully', {
        userId: req.user.id,
        disasterId,
        resourceCount: processedResources.length,
        filters: { type, radius, coordinates: lat && lng ? { lat, lng } : null },
        responseTime
      });

      // Emit WebSocket event for real-time updates
      req.io.to(`disaster_${disasterId}`).emit('resources_updated', {
        disasterId,
        resources: processedResources.slice(0, 10), // Send only first 10 for real-time
        totalCount: processedResources.length,
        filters: { type, radius, coordinates: lat && lng ? { lat, lng } : null }
      });

      res.json(formatResponse(true, {
        resources: processedResources,
        disaster: {
          id: disaster.id,
          title: disaster.title
        },
        filters: { type, radius, coordinates: lat && lng ? { lat, lng } : null },
        totalFound: processedResources.length,
        geospatial_query: !!(lat && lng)
      }, 'Resources fetched successfully'));

    } catch (error) {
      logger.error('Failed to fetch resources', error, {
        userId: req.user.id,
        disasterId,
        filters: { lat, lng, radius, type }
      });

      res.status(500).json(formatErrorResponse(
        'Failed to fetch resources',
        [error.message],
        500
      ));
    }
  })
);

/**
 * GET /api/resources/nearby
 * Get nearby resources across all disasters
 */
router.get('/nearby',
  requirePermission('read'),
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('Latitude is required and must be valid'),
  query('lng').isFloat({ min: -180, max: 180 }).withMessage('Longitude is required and must be valid'),
  query('radius').optional().isInt({ min: 1, max: 50 }).withMessage('Radius must be 1-50 km'),
  query('type').optional().isString().withMessage('Type must be a string'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(validationErrorHandler(errors));
    }

    const { lat, lng, radius = 10, type, limit = 50 } = req.query;
    const supabase = getSupabase();

    try {
      const startTime = Date.now();
      const radiusMeters = parseFloat(radius) * 1000; // Convert km to meters

      // Build the query
      let query = supabase
        .from('resources')
        .select(`
          *,
          disasters (
            id,
            title,
            location_name
          )
        `);

      // Apply type filter if provided
      if (type) {
        query = query.eq('type', type);
      }

      // For nearby query, we'll use a simpler approach if RPC is not available
      query = query.limit(parseInt(limit));

      const { data: allResources, error } = await query;
      
      if (error) {
        throw error;
      }

      // Filter resources by distance (client-side calculation as fallback)
      const nearbyResources = [];
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const maxRadius = parseFloat(radius);

      for (const resource of allResources) {
        if (resource.location) {
          const coords = pointToCoordinates(resource.location);
          if (coords) {
            const distance = calculateDistance(userLat, userLng, coords.lat, coords.lng);
            if (distance <= maxRadius) {
              nearbyResources.push({
                ...resource,
                coordinates: coords,
                distance_km: Math.round(distance * 100) / 100 // Round to 2 decimal places
              });
            }
          }
        }
      }

      // Sort by distance
      nearbyResources.sort((a, b) => a.distance_km - b.distance_km);

      const responseTime = Date.now() - startTime;

      logger.geospatialQuery('nearby_resources', { lat: userLat, lng: userLng }, maxRadius, nearbyResources.length, responseTime, {
        type,
        method: 'client_side_calculation'
      });

      logger.info('Nearby resources fetched successfully', {
        userId: req.user.id,
        coordinates: { lat: userLat, lng: userLng },
        resourceCount: nearbyResources.length,
        filters: { type, radius: maxRadius },
        responseTime
      });

      res.json(formatResponse(true, {
        resources: nearbyResources,
        center: { lat: userLat, lng: userLng },
        filters: { type, radius: maxRadius },
        totalFound: nearbyResources.length
      }, 'Nearby resources fetched successfully'));

    } catch (error) {
      logger.error('Failed to fetch nearby resources', error, {
        userId: req.user.id,
        coordinates: { lat, lng },
        filters: { radius, type }
      });

      res.status(500).json(formatErrorResponse(
        'Failed to fetch nearby resources',
        [error.message],
        500
      ));
    }
  })
);

/**
 * GET /api/resources/types
 * Get available resource types
 */
router.get('/types',
  requirePermission('read'),
  asyncHandler(async (req, res) => {
    const supabase = getSupabase();

    try {
      const { data: types, error } = await supabase
        .from('resources')
        .select('type')
        .then(({ data, error }) => {
          if (error) return { error };
          const uniqueTypes = [...new Set(data.map(r => r.type))].filter(Boolean);
          return { data: uniqueTypes.map(type => ({ type, count: data.filter(r => r.type === type).length })) };
        });

      if (error) {
        throw error;
      }

      logger.info('Resource types fetched', {
        userId: req.user.id,
        typeCount: types.length
      });

      res.json(formatResponse(true, {
        types,
        totalTypes: types.length
      }, 'Resource types fetched successfully'));

    } catch (error) {
      logger.error('Failed to fetch resource types', error, {
        userId: req.user.id
      });

      res.status(500).json(formatErrorResponse(
        'Failed to fetch resource types',
        [error.message],
        500
      ));
    }
  })
);

// Helper function to calculate distance between two points
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = router;
