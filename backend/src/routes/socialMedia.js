const express = require('express');
const { param, query, validationResult } = require('express-validator');
const router = express.Router();

const { getSupabase } = require('../config/database');
const socialMediaService = require('../services/socialMediaService');
const geocodingService = require('../services/geocodingService');
const logger = require('../utils/logger');
const { formatResponse, formatErrorResponse, coordinatesToPoint } = require('../utils/helpers');
const { asyncHandler, validationErrorHandler } = require('../middleware/errorHandler');
const { requirePermission } = require('../middleware/auth');
const { socialMediaLimiter, externalApiLimiter } = require('../middleware/rateLimit');

// Validation rules
const getReportsValidation = [
  param('id').isUUID().withMessage('Invalid disaster ID'),
  query('refresh').optional().isBoolean().withMessage('Refresh must be boolean'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100')
];

/**
 * GET /api/disasters/:id/social-media
 * Get social media reports for a disaster
 */
router.get('/:id/social-media',
  socialMediaLimiter,
  requirePermission('read'),
  getReportsValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(validationErrorHandler(errors));
    }

    const { id: disasterId } = req.params;
    const { refresh = false, limit = 50 } = req.query;
    const supabase = getSupabase();

    try {
      // First, get the disaster to extract keywords and location
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
        // Add disaster type keywords from title
        const titleWords = disaster.title.toLowerCase().split(' ');
        const disasterKeywords = ['flood', 'fire', 'earthquake', 'storm', 'emergency', 'disaster'];
        titleWords.forEach(word => {
          if (disasterKeywords.includes(word) && !keywords.includes(word)) {
            keywords.push(word);
          }
        });
      }

      // Get location for geo-filtering
      let location = null;
      if (disaster.location) {
        const coords = disaster.location.coordinates || disaster.location;
        if (coords && coords.length >= 2) {
          location = { lat: coords[1], lng: coords[0] };
        }
      }

      logger.info('Fetching social media reports', {
        userId: req.user.id,
        disasterId,
        keywords,
        location,
        refresh
      });

      // Check if we should fetch fresh data or use cached/stored data
      let socialMediaData;
      
      if (refresh) {
        // Force refresh from external APIs
        socialMediaData = await socialMediaService.fetchReports(disasterId, keywords, location);
      } else {
        // First check database for recent reports
        const { data: existingReports, error: reportsError } = await supabase
          .from('social_media_reports')
          .select('*')
          .eq('disaster_id', disasterId)
          .gte('fetched_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Last 10 minutes
          .order('created_at', { ascending: false })
          .limit(limit);

        if (reportsError) {
          logger.warn('Failed to fetch existing reports from database:', reportsError);
        }

        if (existingReports && existingReports.length > 0) {
          // Use existing reports
          socialMediaData = {
            reports: existingReports.map(report => ({
              id: report.post_id || report.id,
              platform: report.platform,
              content: report.content,
              author: report.author,
              createdAt: report.created_at,
              locationExtracted: report.location_extracted,
              priorityScore: report.priority_score,
              sentiment: report.sentiment,
              url: `https://${report.platform}.com/post/${report.post_id}`
            })),
            source: 'database',
            disasterId,
            fetchedAt: existingReports[0].fetched_at,
            totalFound: existingReports.length
          };
        } else {
          // Fetch fresh data
          socialMediaData = await socialMediaService.fetchReports(disasterId, keywords, location);
        }
      }

      // Store new reports in database if they came from external APIs
      if (socialMediaData.source !== 'database' && socialMediaData.reports.length > 0) {
        const reportsToStore = socialMediaData.reports.map(report => ({
          disaster_id: disasterId,
          platform: report.platform,
          post_id: report.id,
          content: report.content,
          author: report.author,
          location_extracted: report.locationExtracted,
          priority_score: report.priorityScore || 1,
          sentiment: report.sentiment || 'neutral',
          created_at: report.createdAt || new Date().toISOString(),
          fetched_at: new Date().toISOString()
        }));

        // Geocode extracted locations
        for (const report of reportsToStore) {
          if (report.location_extracted) {
            try {
              const geocodeResult = await geocodingService.geocode(report.location_extracted);
              report.location = coordinatesToPoint(geocodeResult.lat, geocodeResult.lng);
            } catch (geocodeError) {
              logger.warn('Failed to geocode extracted location:', {
                location: report.location_extracted,
                error: geocodeError.message
              });
            }
          }
        }

        // Insert reports into database
        const { error: insertError } = await supabase
          .from('social_media_reports')
          .upsert(reportsToStore, { onConflict: 'post_id,platform' });

        if (insertError) {
          logger.warn('Failed to store social media reports:', insertError);
        } else {
          logger.info('Stored social media reports in database', {
            disasterId,
            reportCount: reportsToStore.length
          });
        }
      }

      // Emit WebSocket event for real-time updates
      if (socialMediaData.reports.length > 0) {
        req.io.to(`disaster_${disasterId}`).emit('social_media_updated', {
          disasterId,
          reports: socialMediaData.reports.slice(0, 5), // Send only first 5 for real-time
          totalCount: socialMediaData.reports.length,
          source: socialMediaData.source,
          fetchedAt: socialMediaData.fetchedAt
        });
      }

      logger.info('Social media reports fetched successfully', {
        userId: req.user.id,
        disasterId,
        reportCount: socialMediaData.reports.length,
        source: socialMediaData.source
      });

      res.json(formatResponse(true, socialMediaData, 'Social media reports fetched successfully'));

    } catch (error) {
      logger.error('Failed to fetch social media reports', error, {
        userId: req.user.id,
        disasterId
      });

      res.status(500).json(formatErrorResponse(
        'Failed to fetch social media reports',
        [error.message],
        500
      ));
    }
  })
);

/**
 * GET /api/social-media/priority
 * Get high-priority social media reports across all disasters
 */
router.get('/priority',
  socialMediaLimiter,
  requirePermission('read'),
  query('min_priority').optional().isInt({ min: 1, max: 10 }).withMessage('Min priority must be 1-10'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(validationErrorHandler(errors));
    }

    const { min_priority = 5, limit = 20 } = req.query;
    const supabase = getSupabase();

    try {
      const { data: priorityReports, error } = await supabase
        .from('social_media_reports')
        .select(`
          *,
          disasters (
            id,
            title,
            location_name
          )
        `)
        .gte('priority_score', min_priority)
        .order('priority_score', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      logger.info('Priority social media reports fetched', {
        userId: req.user.id,
        reportCount: priorityReports.length,
        minPriority: min_priority
      });

      res.json(formatResponse(true, {
        reports: priorityReports,
        filters: {
          min_priority: parseInt(min_priority),
          limit: parseInt(limit)
        },
        totalFound: priorityReports.length
      }, 'Priority social media reports fetched successfully'));

    } catch (error) {
      logger.error('Failed to fetch priority social media reports', error, {
        userId: req.user.id
      });

      res.status(500).json(formatErrorResponse(
        'Failed to fetch priority social media reports',
        [error.message],
        500
      ));
    }
  })
);

/**
 * GET /api/social-media/stats
 * Get social media statistics
 */
router.get('/stats',
  requirePermission('read'),
  asyncHandler(async (req, res) => {
    const supabase = getSupabase();

    try {
      // Get various statistics
      const [
        { count: totalReports },
        { data: platformStats },
        { data: sentimentStats },
        { data: recentActivity }
      ] = await Promise.all([
        supabase.from('social_media_reports').select('*', { count: 'exact', head: true }),
        supabase.from('social_media_reports').select('platform').then(({ data }) => {
          const stats = {};
          data?.forEach(report => {
            stats[report.platform] = (stats[report.platform] || 0) + 1;
          });
          return Object.entries(stats).map(([platform, count]) => ({ platform, count }));
        }),
        supabase.from('social_media_reports').select('sentiment').then(({ data }) => {
          const stats = {};
          data?.forEach(report => {
            stats[report.sentiment] = (stats[report.sentiment] || 0) + 1;
          });
          return Object.entries(stats).map(([sentiment, count]) => ({ sentiment, count }));
        }),
        supabase.from('social_media_reports')
          .select('created_at')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .then(({ data }) => data?.length || 0)
      ]);

      const stats = {
        total_reports: totalReports,
        platform_breakdown: platformStats,
        sentiment_breakdown: sentimentStats,
        reports_last_24h: recentActivity,
        last_updated: new Date().toISOString()
      };

      logger.info('Social media statistics fetched', {
        userId: req.user.id,
        totalReports
      });

      res.json(formatResponse(true, stats, 'Social media statistics fetched successfully'));

    } catch (error) {
      logger.error('Failed to fetch social media statistics', error, {
        userId: req.user.id
      });

      res.status(500).json(formatErrorResponse(
        'Failed to fetch social media statistics',
        [error.message],
        500
      ));
    }
  })
);

module.exports = router;
