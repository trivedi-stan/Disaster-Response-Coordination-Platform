const express = require('express');
const { param, query, validationResult } = require('express-validator');
const router = express.Router();

const { getSupabase } = require('../config/database');
const officialUpdatesService = require('../services/officialUpdatesService');
const logger = require('../utils/logger');
const { formatResponse, formatErrorResponse } = require('../utils/helpers');
const { asyncHandler, validationErrorHandler } = require('../middleware/errorHandler');
const { requirePermission } = require('../middleware/auth');
const { externalApiLimiter } = require('../middleware/rateLimit');

// Validation rules
const getUpdatesValidation = [
  param('id').isUUID().withMessage('Invalid disaster ID'),
  query('refresh').optional().isBoolean().withMessage('Refresh must be boolean'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100')
];

/**
 * GET /api/disasters/:id/official-updates
 * Get official updates for a disaster
 */
router.get('/:id/official-updates',
  externalApiLimiter,
  requirePermission('read'),
  getUpdatesValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(validationErrorHandler(errors));
    }

    const { id: disasterId } = req.params;
    const { refresh = false, limit = 20 } = req.query;
    const supabase = getSupabase();

    try {
      // First, get the disaster to extract keywords
      const { data: disaster, error: disasterError } = await supabase
        .from('disasters')
        .select('*')
        .eq('id', disasterId)
        .single();

      if (disasterError) {
        if (disasterError.code === 'PGRST116') {
          return res.status(404).json(formatErrorResponse('Disaster not found', [], 404));
        }
        throw disasterError;
      }

      // Extract keywords from disaster tags and title
      const keywords = [...(disaster.tags || [])];
      if (disaster.title) {
        const titleWords = disaster.title.toLowerCase().split(' ');
        const relevantKeywords = ['flood', 'fire', 'earthquake', 'storm', 'emergency', 'disaster', 'hurricane', 'tornado'];
        titleWords.forEach(word => {
          if (relevantKeywords.includes(word) && !keywords.includes(word)) {
            keywords.push(word);
          }
        });
      }

      // Add location-based keywords
      if (disaster.location_name) {
        const locationParts = disaster.location_name.split(',').map(part => part.trim());
        keywords.push(...locationParts);
      }

      logger.info('Fetching official updates', {
        userId: req.user.id,
        disasterId,
        keywords,
        refresh
      });

      let officialUpdatesData;

      if (refresh) {
        // Force refresh from external sources
        officialUpdatesData = await officialUpdatesService.fetchUpdates(disasterId, keywords);
      } else {
        // First check database for recent updates
        const { data: existingUpdates, error: updatesError } = await supabase
          .from('official_updates')
          .select('*')
          .eq('disaster_id', disasterId)
          .gte('fetched_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last 1 hour
          .order('published_at', { ascending: false })
          .limit(parseInt(limit));

        if (updatesError) {
          logger.warn('Failed to fetch existing updates from database:', updatesError);
        }

        if (existingUpdates && existingUpdates.length > 0) {
          // Use existing updates
          officialUpdatesData = {
            updates: existingUpdates,
            disasterId,
            fetchedAt: existingUpdates[0].fetched_at,
            totalFound: existingUpdates.length,
            source: 'database'
          };
        } else {
          // Fetch fresh data
          officialUpdatesData = await officialUpdatesService.fetchUpdates(disasterId, keywords);
        }
      }

      // Store new updates in database if they came from external sources
      if (officialUpdatesData.source !== 'database' && officialUpdatesData.updates.length > 0) {
        const updatesToStore = officialUpdatesData.updates.map(update => ({
          disaster_id: disasterId,
          source: update.source,
          title: update.title,
          content: update.content,
          url: update.url,
          published_at: update.publishedAt,
          fetched_at: new Date().toISOString()
        }));

        // Insert updates into database
        const { error: insertError } = await supabase
          .from('official_updates')
          .upsert(updatesToStore, { onConflict: 'url' });

        if (insertError) {
          logger.warn('Failed to store official updates:', insertError);
        } else {
          logger.info('Stored official updates in database', {
            disasterId,
            updateCount: updatesToStore.length
          });
        }
      }

      // Group updates by source for better organization
      const updatesBySource = {};
      officialUpdatesData.updates.forEach(update => {
        if (!updatesBySource[update.source]) {
          updatesBySource[update.source] = [];
        }
        updatesBySource[update.source].push(update);
      });

      const responseData = {
        ...officialUpdatesData,
        updatesBySource,
        availableSources: Object.keys(updatesBySource),
        summary: {
          totalUpdates: officialUpdatesData.updates.length,
          sourceCount: Object.keys(updatesBySource).length,
          latestUpdate: officialUpdatesData.updates.length > 0 
            ? officialUpdatesData.updates[0].publishedAt 
            : null
        }
      };

      logger.info('Official updates fetched successfully', {
        userId: req.user.id,
        disasterId,
        updateCount: officialUpdatesData.updates.length,
        sources: Object.keys(updatesBySource),
        source: officialUpdatesData.source
      });

      res.json(formatResponse(true, responseData, 'Official updates fetched successfully'));

    } catch (error) {
      logger.error('Failed to fetch official updates', error, {
        userId: req.user.id,
        disasterId
      });

      res.status(500).json(formatErrorResponse(
        'Failed to fetch official updates',
        [error.message],
        500
      ));
    }
  })
);

/**
 * GET /api/official-updates/sources
 * Get available official update sources
 */
router.get('/sources',
  requirePermission('read'),
  asyncHandler(async (req, res) => {
    try {
      const sources = officialUpdatesService.getAvailableSources();
      
      logger.info('Official update sources fetched', {
        userId: req.user.id,
        sourceCount: sources.length
      });

      res.json(formatResponse(true, {
        sources,
        totalSources: sources.length
      }, 'Official update sources fetched successfully'));

    } catch (error) {
      logger.error('Failed to fetch official update sources', error, {
        userId: req.user.id
      });

      res.status(500).json(formatErrorResponse(
        'Failed to fetch official update sources',
        [error.message],
        500
      ));
    }
  })
);

/**
 * GET /api/official-updates/recent
 * Get recent official updates across all disasters
 */
router.get('/recent',
  requirePermission('read'),
  query('hours').optional().isInt({ min: 1, max: 168 }).withMessage('Hours must be 1-168 (1 week)'),
  query('source').optional().isString().withMessage('Source must be a string'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(validationErrorHandler(errors));
    }

    const { hours = 24, source, limit = 50 } = req.query;
    const supabase = getSupabase();

    try {
      const sinceTime = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000).toISOString();

      let query = supabase
        .from('official_updates')
        .select(`
          *,
          disasters (
            id,
            title,
            location_name
          )
        `)
        .gte('published_at', sinceTime);

      // Apply source filter if provided
      if (source) {
        query = query.eq('source', source);
      }

      // Apply ordering and limit
      query = query.order('published_at', { ascending: false }).limit(parseInt(limit));

      const { data: recentUpdates, error } = await query;

      if (error) {
        throw error;
      }

      // Group by source for summary
      const updatesBySource = {};
      recentUpdates.forEach(update => {
        if (!updatesBySource[update.source]) {
          updatesBySource[update.source] = 0;
        }
        updatesBySource[update.source]++;
      });

      logger.info('Recent official updates fetched', {
        userId: req.user.id,
        updateCount: recentUpdates.length,
        hours: parseInt(hours),
        source
      });

      res.json(formatResponse(true, {
        updates: recentUpdates,
        filters: {
          hours: parseInt(hours),
          source,
          limit: parseInt(limit)
        },
        summary: {
          totalUpdates: recentUpdates.length,
          timeRange: `${hours} hours`,
          updatesBySource
        }
      }, 'Recent official updates fetched successfully'));

    } catch (error) {
      logger.error('Failed to fetch recent official updates', error, {
        userId: req.user.id,
        hours,
        source
      });

      res.status(500).json(formatErrorResponse(
        'Failed to fetch recent official updates',
        [error.message],
        500
      ));
    }
  })
);

/**
 * GET /api/official-updates/stats
 * Get official updates statistics
 */
router.get('/stats',
  requirePermission('read'),
  asyncHandler(async (req, res) => {
    const supabase = getSupabase();

    try {
      // Get various statistics
      const [
        { count: totalUpdates },
        { data: sourceStats },
        { data: recentActivity }
      ] = await Promise.all([
        supabase.from('official_updates').select('*', { count: 'exact', head: true }),
        supabase.from('official_updates').select('source').then(({ data }) => {
          const stats = {};
          data?.forEach(update => {
            stats[update.source] = (stats[update.source] || 0) + 1;
          });
          return Object.entries(stats).map(([source, count]) => ({ source, count }));
        }),
        supabase.from('official_updates')
          .select('published_at')
          .gte('published_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .then(({ data }) => data?.length || 0)
      ]);

      const stats = {
        total_updates: totalUpdates,
        source_breakdown: sourceStats,
        updates_last_24h: recentActivity,
        last_updated: new Date().toISOString()
      };

      logger.info('Official updates statistics fetched', {
        userId: req.user.id,
        totalUpdates
      });

      res.json(formatResponse(true, stats, 'Official updates statistics fetched successfully'));

    } catch (error) {
      logger.error('Failed to fetch official updates statistics', error, {
        userId: req.user.id
      });

      res.status(500).json(formatErrorResponse(
        'Failed to fetch official updates statistics',
        [error.message],
        500
      ));
    }
  })
);

module.exports = router;
