const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();

const { getSupabase } = require('../config/database');
const geminiService = require('../services/geminiService');
const logger = require('../utils/logger');
const { formatResponse, formatErrorResponse, addAuditEntry } = require('../utils/helpers');
const { asyncHandler, validationErrorHandler } = require('../middleware/errorHandler');
const { requirePermission } = require('../middleware/auth');
const { imageVerificationLimiter, externalApiLimiter } = require('../middleware/rateLimit');

// Validation rules
const verifyImageValidation = [
  param('id').isUUID().withMessage('Invalid disaster ID'),
  body('image_url').isURL().withMessage('Valid image URL is required'),
  body('report_id').optional().isUUID().withMessage('Invalid report ID'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description must be less than 500 characters')
];

/**
 * POST /api/disasters/:id/verify-image
 * Verify disaster image authenticity using Gemini API
 */
router.post('/:id/verify-image',
  imageVerificationLimiter,
  externalApiLimiter,
  requirePermission('verify_images'),
  verifyImageValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(validationErrorHandler(errors));
    }

    const { id: disasterId } = req.params;
    const { image_url, report_id, description } = req.body;
    const supabase = getSupabase();

    try {
      // First, verify the disaster exists
      const { data: disaster, error: disasterError } = await supabase
        .from('disasters')
        .select('id, title')
        .eq('id', disasterId)
        .single();

      if (disasterError) {
        if (disasterError.code === 'PGRST116') {
          return res.status(404).json(formatErrorResponse('Disaster not found', [], 404));
        }
        throw disasterError;
      }

      // If report_id is provided, verify the report exists
      let report = null;
      if (report_id) {
        const { data: reportData, error: reportError } = await supabase
          .from('reports')
          .select('*')
          .eq('id', report_id)
          .eq('disaster_id', disasterId)
          .single();

        if (reportError && reportError.code !== 'PGRST116') {
          throw reportError;
        }

        report = reportData;
      }

      logger.info('Starting image verification', {
        userId: req.user.id,
        disasterId,
        imageUrl: image_url,
        reportId: report_id,
        hasDescription: !!description
      });

      const startTime = Date.now();

      // Verify image using Gemini service
      const verificationResult = await geminiService.verifyImage(image_url);
      const responseTime = Date.now() - startTime;

      // Determine verification status based on AI analysis
      let verificationStatus = 'pending';
      if (verificationResult.isAuthentic && verificationResult.confidence >= 80) {
        verificationStatus = 'verified';
      } else if (!verificationResult.isAuthentic || verificationResult.confidence < 50) {
        verificationStatus = 'rejected';
      }

      // Create verification record
      const verificationRecord = {
        disaster_id: disasterId,
        report_id: report_id || null,
        image_url,
        verification_status: verificationStatus,
        ai_analysis: {
          is_authentic: verificationResult.isAuthentic,
          confidence: verificationResult.confidence,
          disaster_type: verificationResult.disasterType,
          reasoning: verificationResult.reasoning,
          manipulation_signs: verificationResult.manipulationSigns,
          source: verificationResult.source,
          verified_by: req.user.id,
          verified_at: new Date().toISOString(),
          response_time_ms: responseTime
        },
        description: description || null,
        verified_by: req.user.id,
        created_at: new Date().toISOString()
      };

      // If this is for an existing report, update the report's verification status
      if (report) {
        const { error: updateError } = await supabase
          .from('reports')
          .update({
            verification_status: verificationStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', report_id);

        if (updateError) {
          logger.warn('Failed to update report verification status:', updateError);
        }
      }

      // Store verification record (you might want to create a separate table for this)
      // For now, we'll store it in the reports table or create a new verification entry

      logger.info('Image verification completed', {
        userId: req.user.id,
        disasterId,
        imageUrl: image_url,
        verificationStatus,
        confidence: verificationResult.confidence,
        isAuthentic: verificationResult.isAuthentic,
        responseTime,
        source: verificationResult.source
      });

      // Prepare response data
      const responseData = {
        verification: {
          status: verificationStatus,
          confidence: verificationResult.confidence,
          is_authentic: verificationResult.isAuthentic,
          disaster_type: verificationResult.disasterType,
          reasoning: verificationResult.reasoning,
          manipulation_signs: verificationResult.manipulationSigns || [],
          verified_by: req.user.id,
          verified_at: new Date().toISOString()
        },
        image_url,
        disaster: {
          id: disaster.id,
          title: disaster.title
        },
        report_id: report_id || null,
        processing: {
          response_time_ms: responseTime,
          ai_source: verificationResult.source
        }
      };

      // Emit WebSocket event for real-time updates
      req.io.to(`disaster_${disasterId}`).emit('image_verified', {
        disasterId,
        imageUrl: image_url,
        verificationStatus,
        confidence: verificationResult.confidence,
        verifiedBy: req.user.id
      });

      const message = verificationStatus === 'verified' 
        ? 'Image verified as authentic'
        : verificationStatus === 'rejected'
        ? 'Image verification failed - potential issues detected'
        : 'Image verification pending - requires manual review';

      res.json(formatResponse(true, responseData, message));

    } catch (error) {
      logger.error('Image verification failed', error, {
        userId: req.user.id,
        disasterId,
        imageUrl: image_url,
        reportId: report_id
      });

      res.status(500).json(formatErrorResponse(
        'Image verification failed',
        [error.message],
        500
      ));
    }
  })
);

/**
 * POST /api/verify-image/batch
 * Batch verify multiple images
 */
router.post('/batch',
  imageVerificationLimiter,
  externalApiLimiter,
  requirePermission('verify_images'),
  body('images').isArray({ min: 1, max: 5 }).withMessage('Images must be an array of 1-5 items'),
  body('images.*.image_url').isURL().withMessage('Each image must have a valid URL'),
  body('images.*.disaster_id').isUUID().withMessage('Each image must have a valid disaster ID'),
  body('images.*.report_id').optional().isUUID().withMessage('Report ID must be valid if provided'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(validationErrorHandler(errors));
    }

    const { images } = req.body;
    const results = [];
    const startTime = Date.now();

    try {
      logger.info('Starting batch image verification', {
        userId: req.user.id,
        imageCount: images.length
      });

      for (const imageData of images) {
        try {
          const verificationResult = await geminiService.verifyImage(imageData.image_url);
          
          let verificationStatus = 'pending';
          if (verificationResult.isAuthentic && verificationResult.confidence >= 80) {
            verificationStatus = 'verified';
          } else if (!verificationResult.isAuthentic || verificationResult.confidence < 50) {
            verificationStatus = 'rejected';
          }

          results.push({
            image_url: imageData.image_url,
            disaster_id: imageData.disaster_id,
            report_id: imageData.report_id || null,
            success: true,
            verification: {
              status: verificationStatus,
              confidence: verificationResult.confidence,
              is_authentic: verificationResult.isAuthentic,
              disaster_type: verificationResult.disasterType,
              reasoning: verificationResult.reasoning,
              manipulation_signs: verificationResult.manipulationSigns || []
            }
          });

        } catch (error) {
          results.push({
            image_url: imageData.image_url,
            disaster_id: imageData.disaster_id,
            report_id: imageData.report_id || null,
            success: false,
            error: error.message
          });
        }
      }

      const responseTime = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;

      logger.info('Batch image verification completed', {
        userId: req.user.id,
        totalImages: images.length,
        successCount,
        responseTime
      });

      res.json(formatResponse(true, {
        results,
        summary: {
          total_images: images.length,
          successful_verifications: successCount,
          failed_verifications: images.length - successCount,
          response_time_ms: responseTime
        }
      }, `Batch verification completed: ${successCount}/${images.length} successful`));

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Batch image verification failed', error, {
        userId: req.user.id,
        imageCount: images.length,
        responseTime
      });

      res.status(500).json(formatErrorResponse(
        'Batch image verification failed',
        [error.message],
        500
      ));
    }
  })
);

/**
 * GET /api/verify-image/stats
 * Get image verification statistics
 */
router.get('/stats',
  requirePermission('read'),
  asyncHandler(async (req, res) => {
    const supabase = getSupabase();

    try {
      // Get verification statistics from reports table
      const { data: verificationStats, error } = await supabase
        .from('reports')
        .select('verification_status')
        .not('verification_status', 'is', null);

      if (error) {
        throw error;
      }

      // Calculate statistics
      const stats = {
        verified: 0,
        rejected: 0,
        pending: 0
      };

      verificationStats.forEach(report => {
        if (stats.hasOwnProperty(report.verification_status)) {
          stats[report.verification_status]++;
        }
      });

      const totalVerifications = stats.verified + stats.rejected + stats.pending;

      logger.info('Image verification statistics fetched', {
        userId: req.user.id,
        totalVerifications
      });

      res.json(formatResponse(true, {
        statistics: stats,
        total_verifications: totalVerifications,
        verification_rate: totalVerifications > 0 ? {
          verified_percentage: Math.round((stats.verified / totalVerifications) * 100),
          rejected_percentage: Math.round((stats.rejected / totalVerifications) * 100),
          pending_percentage: Math.round((stats.pending / totalVerifications) * 100)
        } : null,
        last_updated: new Date().toISOString()
      }, 'Image verification statistics fetched successfully'));

    } catch (error) {
      logger.error('Failed to fetch image verification statistics', error, {
        userId: req.user.id
      });

      res.status(500).json(formatErrorResponse(
        'Failed to fetch image verification statistics',
        [error.message],
        500
      ));
    }
  })
);

module.exports = router;
