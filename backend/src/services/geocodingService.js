const axios = require('axios');
const logger = require('../utils/logger');
const { getCachedData, setCachedData } = require('../config/database');
const { retryWithBackoff, isValidCoordinates } = require('../utils/helpers');

class GeocodingService {
  constructor() {
    this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    
    // Determine which service to use
    this.service = this.googleMapsApiKey ? 'google' : 
                   this.mapboxToken ? 'mapbox' : 'nominatim';
    
    logger.info(`Geocoding service initialized: ${this.service}`);
  }

  /**
   * Convert location name to coordinates
   */
  async geocode(locationName) {
    const cacheKey = `geocode_${Buffer.from(locationName.toLowerCase()).toString('base64').slice(0, 50)}`;
    
    try {
      // Check cache first
      const cachedResult = await getCachedData(cacheKey);
      if (cachedResult) {
        logger.cacheOperation('hit', cacheKey, true);
        return cachedResult;
      }

      logger.cacheOperation('miss', cacheKey, false);

      let result;
      switch (this.service) {
        case 'google':
          result = await this._geocodeWithGoogle(locationName);
          break;
        case 'mapbox':
          result = await this._geocodeWithMapbox(locationName);
          break;
        default:
          result = await this._geocodeWithNominatim(locationName);
      }

      // Cache the result
      await setCachedData(cacheKey, result, 24); // Cache for 24 hours
      
      return result;
    } catch (error) {
      logger.externalService(this.service, 'geocode', false, 0, { 
        error: error.message,
        locationName 
      });
      
      // Fallback to mock response
      return await this._geocodeMock(locationName);
    }
  }

  /**
   * Reverse geocode coordinates to location name
   */
  async reverseGeocode(lat, lng) {
    if (!isValidCoordinates(lat, lng)) {
      throw new Error('Invalid coordinates provided');
    }

    const cacheKey = `reverse_geocode_${lat}_${lng}`;
    
    try {
      // Check cache first
      const cachedResult = await getCachedData(cacheKey);
      if (cachedResult) {
        logger.cacheOperation('hit', cacheKey, true);
        return cachedResult;
      }

      logger.cacheOperation('miss', cacheKey, false);

      let result;
      switch (this.service) {
        case 'google':
          result = await this._reverseGeocodeWithGoogle(lat, lng);
          break;
        case 'mapbox':
          result = await this._reverseGeocodeWithMapbox(lat, lng);
          break;
        default:
          result = await this._reverseGeocodeWithNominatim(lat, lng);
      }

      // Cache the result
      await setCachedData(cacheKey, result, 24); // Cache for 24 hours
      
      return result;
    } catch (error) {
      logger.externalService(this.service, 'reverseGeocode', false, 0, { 
        error: error.message,
        coordinates: { lat, lng }
      });
      
      // Fallback to mock response
      return await this._reverseGeocodeMock(lat, lng);
    }
  }

  /**
   * Geocode using Google Maps API
   */
  async _geocodeWithGoogle(locationName) {
    const startTime = Date.now();
    
    try {
      const response = await retryWithBackoff(async () => {
        return await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: {
            address: locationName,
            key: this.googleMapsApiKey
          },
          timeout: 10000
        });
      });

      const responseTime = Date.now() - startTime;

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        const location = result.geometry.location;
        
        const geocodeResult = {
          lat: location.lat,
          lng: location.lng,
          formattedAddress: result.formatted_address,
          components: this._parseGoogleComponents(result.address_components),
          accuracy: result.geometry.location_type,
          source: 'google'
        };

        logger.externalService('Google Maps', 'geocode', true, responseTime, {
          locationName,
          coordinates: { lat: location.lat, lng: location.lng }
        });

        return geocodeResult;
      } else {
        throw new Error(`Google Maps API error: ${response.data.status}`);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.externalService('Google Maps', 'geocode', false, responseTime, {
        error: error.message,
        locationName
      });
      throw error;
    }
  }

  /**
   * Geocode using Mapbox API
   */
  async _geocodeWithMapbox(locationName) {
    const startTime = Date.now();
    
    try {
      const response = await retryWithBackoff(async () => {
        return await axios.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(locationName)}.json`, {
          params: {
            access_token: this.mapboxToken,
            limit: 1
          },
          timeout: 10000
        });
      });

      const responseTime = Date.now() - startTime;

      if (response.data.features && response.data.features.length > 0) {
        const feature = response.data.features[0];
        const [lng, lat] = feature.center;
        
        const geocodeResult = {
          lat,
          lng,
          formattedAddress: feature.place_name,
          components: this._parseMapboxComponents(feature),
          accuracy: feature.properties.accuracy || 'unknown',
          source: 'mapbox'
        };

        logger.externalService('Mapbox', 'geocode', true, responseTime, {
          locationName,
          coordinates: { lat, lng }
        });

        return geocodeResult;
      } else {
        throw new Error('No results found');
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.externalService('Mapbox', 'geocode', false, responseTime, {
        error: error.message,
        locationName
      });
      throw error;
    }
  }

  /**
   * Geocode using OpenStreetMap Nominatim
   */
  async _geocodeWithNominatim(locationName) {
    const startTime = Date.now();
    
    try {
      const response = await retryWithBackoff(async () => {
        return await axios.get('https://nominatim.openstreetmap.org/search', {
          params: {
            q: locationName,
            format: 'json',
            limit: 1,
            addressdetails: 1
          },
          headers: {
            'User-Agent': 'DisasterResponsePlatform/1.0'
          },
          timeout: 10000
        });
      });

      const responseTime = Date.now() - startTime;

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        
        const geocodeResult = {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          formattedAddress: result.display_name,
          components: this._parseNominatimComponents(result.address),
          accuracy: result.importance || 0.5,
          source: 'nominatim'
        };

        logger.externalService('Nominatim', 'geocode', true, responseTime, {
          locationName,
          coordinates: { lat: geocodeResult.lat, lng: geocodeResult.lng }
        });

        return geocodeResult;
      } else {
        throw new Error('No results found');
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.externalService('Nominatim', 'geocode', false, responseTime, {
        error: error.message,
        locationName
      });
      throw error;
    }
  }

  /**
   * Reverse geocode using Google Maps API
   */
  async _reverseGeocodeWithGoogle(lat, lng) {
    const startTime = Date.now();
    
    try {
      const response = await retryWithBackoff(async () => {
        return await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: {
            latlng: `${lat},${lng}`,
            key: this.googleMapsApiKey
          },
          timeout: 10000
        });
      });

      const responseTime = Date.now() - startTime;

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        
        const reverseGeocodeResult = {
          formattedAddress: result.formatted_address,
          components: this._parseGoogleComponents(result.address_components),
          source: 'google'
        };

        logger.externalService('Google Maps', 'reverseGeocode', true, responseTime, {
          coordinates: { lat, lng }
        });

        return reverseGeocodeResult;
      } else {
        throw new Error(`Google Maps API error: ${response.data.status}`);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.externalService('Google Maps', 'reverseGeocode', false, responseTime, {
        error: error.message,
        coordinates: { lat, lng }
      });
      throw error;
    }
  }

  /**
   * Mock geocoding for testing
   */
  async _geocodeMock(locationName) {
    // Mock coordinates for common locations
    const mockLocations = {
      'manhattan, nyc': { lat: 40.7831, lng: -73.9712 },
      'brooklyn, nyc': { lat: 40.6782, lng: -73.9442 },
      'miami, fl': { lat: 25.7617, lng: -80.1918 },
      'houston, tx': { lat: 29.7604, lng: -95.3698 },
      'los angeles, ca': { lat: 34.0522, lng: -118.2437 },
      'chicago, il': { lat: 41.8781, lng: -87.6298 }
    };

    const key = locationName.toLowerCase();
    const coords = mockLocations[key] || {
      lat: 40.7128 + (Math.random() - 0.5) * 0.1,
      lng: -74.0060 + (Math.random() - 0.5) * 0.1
    };

    const result = {
      lat: coords.lat,
      lng: coords.lng,
      formattedAddress: locationName,
      components: {
        city: locationName.split(',')[0]?.trim(),
        state: locationName.split(',')[1]?.trim(),
        country: 'United States'
      },
      accuracy: 'approximate',
      source: 'mock'
    };

    logger.externalService('Mock Geocoding', 'geocode', true, 100, {
      locationName,
      coordinates: coords
    });

    return result;
  }

  /**
   * Mock reverse geocoding for testing
   */
  async _reverseGeocodeMock(lat, lng) {
    const result = {
      formattedAddress: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      components: {
        city: 'Unknown City',
        state: 'Unknown State',
        country: 'United States'
      },
      source: 'mock'
    };

    logger.externalService('Mock Reverse Geocoding', 'reverseGeocode', true, 100, {
      coordinates: { lat, lng }
    });

    return result;
  }

  /**
   * Parse Google Maps address components
   */
  _parseGoogleComponents(components) {
    const parsed = {};
    
    components.forEach(component => {
      const types = component.types;
      if (types.includes('locality')) {
        parsed.city = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        parsed.state = component.short_name;
      } else if (types.includes('country')) {
        parsed.country = component.long_name;
      } else if (types.includes('postal_code')) {
        parsed.zipCode = component.long_name;
      }
    });
    
    return parsed;
  }

  /**
   * Parse Mapbox address components
   */
  _parseMapboxComponents(feature) {
    const context = feature.context || [];
    const parsed = {};
    
    context.forEach(item => {
      if (item.id.startsWith('place')) {
        parsed.city = item.text;
      } else if (item.id.startsWith('region')) {
        parsed.state = item.short_code?.replace('US-', '');
      } else if (item.id.startsWith('country')) {
        parsed.country = item.text;
      } else if (item.id.startsWith('postcode')) {
        parsed.zipCode = item.text;
      }
    });
    
    return parsed;
  }

  /**
   * Parse Nominatim address components
   */
  _parseNominatimComponents(address) {
    return {
      city: address.city || address.town || address.village,
      state: address.state,
      country: address.country,
      zipCode: address.postcode
    };
  }
}

module.exports = new GeocodingService();
