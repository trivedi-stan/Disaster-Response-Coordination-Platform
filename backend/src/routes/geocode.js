const express = require('express');
const { body, query, validationResult } = require('express-validator');
const router = express.Router();

const geminiService = require('../services/geminiService');
const geocodingService = require('../services/geocodingService');
const logger = require('../utils/logger');
const { formatResponse, formatErrorResponse } = require('../utils/helpers');
const { asyncHandler, validationErrorHandler } = require('../middleware/errorHandler');
const { requirePermission } = require('../middleware/auth');
const { geocodingLimiter, externalApiLimiter } = require('../middleware/rateLimit');

// Validation rules
const geocodeValidation = [
  body('description').optional().isLength({ min: 1, max: 2000 }).withMessage('Description must be 1-2000 characters'),
  body('location_name').optional().isLength({ min: 1, max: 100 }).withMessage('Location name must be 1-100 characters')
];

const reverseGeocodeValidation = [
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  query('lng').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude')
];

/**
 * POST /api/geocode
 * Extract location from description and convert to coordinates
 */
router.post('/', 
  geocodingLimiter,
  externalApiLimiter,
  requirePermission('read'),
  geocodeValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(validationErrorHandler(errors));
    }

    const { description, location_name } = req.body;
    
    if (!description && !location_name) {
      return res.status(400).json(formatErrorResponse(
        'Either description or location_name is required',
        ['Provide either description for location extraction or location_name for direct geocoding'],
        400
      ));
    }

    const startTime = Date.now();
    const results = [];

    try {
      let locationsToGeocode = [];

      // If description provided, extract locations using Gemini
      if (description) {
        logger.info('Extracting locations from description', {
          userId: req.user.id,
          descriptionLength: description.length
        });

        const locationExtraction = await geminiService.extractLocation(description);
        
        if (locationExtraction.locations && locationExtraction.locations.length > 0) {
          locationsToGeocode = locationExtraction.locations;
          
          results.push({
            step: 'location_extraction',
            success: true,
            source: locationExtraction.source,
            locations_found: locationExtraction.locations,
            message: `Found ${locationExtraction.locations.length} location(s) in description`
          });
        } else {
          results.push({
            step: 'location_extraction',
            success: false,
            source: locationExtraction.source,
            locations_found: [],
            message: 'No locations found in description'
          });
        }
      }

      // If location_name provided directly, add it to geocoding list
      if (location_name) {
        locationsToGeocode.push(location_name);
        results.push({
          step: 'direct_location',
          success: true,
          location: location_name,
          message: 'Using provided location name'
        });
      }

      // Geocode all found locations
      const geocodedLocations = [];
      
      for (const location of locationsToGeocode.slice(0, 5)) { // Limit to 5 locations
        try {
          logger.info('Geocoding location', {
            userId: req.user.id,
            location
          });

          const geocodeResult = await geocodingService.geocode(location);
          
          geocodedLocations.push({
            location_name: location,
            ...geocodeResult,
            geocoding_success: true
          });

          results.push({
            step: 'geocoding',
            success: true,
            location,
            coordinates: { lat: geocodeResult.lat, lng: geocodeResult.lng },
            formatted_address: geocodeResult.formattedAddress,
            source: geocodeResult.source,
            message: `Successfully geocoded ${location}`
          });

        } catch (geocodeError) {
          logger.warn('Failed to geocode location', {
            userId: req.user.id,
            location,
            error: geocodeError.message
          });

          geocodedLocations.push({
            location_name: location,
            geocoding_success: false,
            error: geocodeError.message
          });

          results.push({
            step: 'geocoding',
            success: false,
            location,
            error: geocodeError.message,
            message: `Failed to geocode ${location}`
          });
        }
      }

      const responseTime = Date.now() - startTime;
      const successfulGeocodings = geocodedLocations.filter(loc => loc.geocoding_success);

      logger.info('Geocoding process completed', {
        userId: req.user.id,
        totalLocations: locationsToGeocode.length,
        successfulGeocodings: successfulGeocodings.length,
        responseTime
      });

      // Prepare response
      const responseData = {
        locations: geocodedLocations,
        summary: {
          total_locations_found: locationsToGeocode.length,
          successful_geocodings: successfulGeocodings.length,
          failed_geocodings: geocodedLocations.length - successfulGeocodings.length,
          response_time_ms: responseTime
        },
        processing_steps: results,
        primary_location: successfulGeocodings.length > 0 ? successfulGeocodings[0] : null
      };

      const message = successfulGeocodings.length > 0 
        ? `Successfully processed ${successfulGeocodings.length} location(s)`
        : 'No locations could be geocoded';

      res.json(formatResponse(true, responseData, message));

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Geocoding process failed', error, {
        userId: req.user.id,
        description: description?.substring(0, 100),
        location_name,
        responseTime
      });

      results.push({
        step: 'error',
        success: false,
        error: error.message,
        message: 'Geocoding process failed'
      });

      res.status(500).json(formatErrorResponse(
        'Geocoding process failed',
        [error.message],
        500
      ));
    }
  })
);

/**
 * GET /api/geocode/reverse
 * Reverse geocode coordinates to location name
 */
router.get('/reverse',
  geocodingLimiter,
  externalApiLimiter,
  requirePermission('read'),
  reverseGeocodeValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(validationErrorHandler(errors));
    }

    const { lat, lng } = req.query;
    const startTime = Date.now();

    try {
      logger.info('Reverse geocoding coordinates', {
        userId: req.user.id,
        coordinates: { lat: parseFloat(lat), lng: parseFloat(lng) }
      });

      const result = await geocodingService.reverseGeocode(parseFloat(lat), parseFloat(lng));
      const responseTime = Date.now() - startTime;

      logger.info('Reverse geocoding completed', {
        userId: req.user.id,
        coordinates: { lat: parseFloat(lat), lng: parseFloat(lng) },
        formattedAddress: result.formattedAddress,
        source: result.source,
        responseTime
      });

      const responseData = {
        coordinates: { lat: parseFloat(lat), lng: parseFloat(lng) },
        ...result,
        response_time_ms: responseTime
      };

      res.json(formatResponse(true, responseData, 'Reverse geocoding completed successfully'));

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Reverse geocoding failed', error, {
        userId: req.user.id,
        coordinates: { lat: parseFloat(lat), lng: parseFloat(lng) },
        responseTime
      });

      res.status(500).json(formatErrorResponse(
        'Reverse geocoding failed',
        [error.message],
        500
      ));
    }
  })
);

/**
 * POST /api/geocode/batch
 * Batch geocode multiple locations
 */
router.post('/batch',
  geocodingLimiter,
  externalApiLimiter,
  requirePermission('read'),
  body('locations').isArray({ min: 1, max: 10 }).withMessage('Locations must be an array of 1-10 items'),
  body('locations.*').isLength({ min: 1, max: 100 }).withMessage('Each location must be 1-100 characters'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(validationErrorHandler(errors));
    }

    const { locations } = req.body;
    const startTime = Date.now();
    const results = [];

    try {
      logger.info('Batch geocoding started', {
        userId: req.user.id,
        locationCount: locations.length
      });

      for (const location of locations) {
        try {
          const geocodeResult = await geocodingService.geocode(location);
          
          results.push({
            location_name: location,
            success: true,
            ...geocodeResult
          });

        } catch (error) {
          results.push({
            location_name: location,
            success: false,
            error: error.message
          });
        }
      }

      const responseTime = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;

      logger.info('Batch geocoding completed', {
        userId: req.user.id,
        totalLocations: locations.length,
        successCount,
        responseTime
      });

      const responseData = {
        results,
        summary: {
          total_locations: locations.length,
          successful: successCount,
          failed: locations.length - successCount,
          response_time_ms: responseTime
        }
      };

      res.json(formatResponse(true, responseData, `Batch geocoding completed: ${successCount}/${locations.length} successful`));

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Batch geocoding failed', error, {
        userId: req.user.id,
        locationCount: locations.length,
        responseTime
      });

      res.status(500).json(formatErrorResponse(
        'Batch geocoding failed',
        [error.message],
        500
      ));
    }
  })
);

module.exports = router;
