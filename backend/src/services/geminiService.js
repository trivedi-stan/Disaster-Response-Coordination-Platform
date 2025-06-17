const axios = require('axios');
const logger = require('../utils/logger');
const { getCachedData, setCachedData } = require('../config/database');
const { retryWithBackoff } = require('../utils/helpers');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    
    if (!this.apiKey) {
      logger.warn('Gemini API key not configured. Service will use mock responses.');
    }
  }

  /**
   * Extract location names from disaster description
   */
  async extractLocation(description) {
    const cacheKey = `gemini_location_${Buffer.from(description).toString('base64').slice(0, 50)}`;
    
    try {
      // Check cache first
      const cachedResult = await getCachedData(cacheKey);
      if (cachedResult) {
        logger.cacheOperation('hit', cacheKey, true);
        return cachedResult;
      }

      logger.cacheOperation('miss', cacheKey, false);

      let result;
      if (this.apiKey) {
        result = await this._extractLocationWithAPI(description);
      } else {
        result = await this._extractLocationMock(description);
      }

      // Cache the result
      await setCachedData(cacheKey, result, 1);
      
      return result;
    } catch (error) {
      logger.externalService('Gemini', 'extractLocation', false, 0, { error: error.message });
      
      // Fallback to mock response
      return await this._extractLocationMock(description);
    }
  }

  /**
   * Extract location using Gemini API
   */
  async _extractLocationWithAPI(description) {
    const startTime = Date.now();
    
    try {
      const prompt = `Extract location names from the following disaster description. Return only the location names as a JSON array, without any additional text or explanation. If no locations are found, return an empty array.

Description: "${description}"

Example response format: ["Manhattan, NYC", "Brooklyn Bridge", "Central Park"]`;

      const response = await retryWithBackoff(async () => {
        return await axios.post(
          `${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`,
          {
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              temperature: 0.1,
              topK: 1,
              topP: 1,
              maxOutputTokens: 256,
            }
          },
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );
      });

      const responseTime = Date.now() - startTime;
      
      if (response.data && response.data.candidates && response.data.candidates[0]) {
        const text = response.data.candidates[0].content.parts[0].text.trim();
        
        try {
          // Try to parse as JSON
          const locations = JSON.parse(text);
          if (Array.isArray(locations)) {
            logger.externalService('Gemini', 'extractLocation', true, responseTime, {
              locationsFound: locations.length
            });
            return { locations, source: 'gemini' };
          }
        } catch (parseError) {
          // If JSON parsing fails, try to extract locations from text
          const locations = this._parseLocationText(text);
          logger.externalService('Gemini', 'extractLocation', true, responseTime, {
            locationsFound: locations.length,
            parseMethod: 'text'
          });
          return { locations, source: 'gemini' };
        }
      }

      logger.externalService('Gemini', 'extractLocation', false, responseTime, {
        error: 'No valid response from API'
      });
      
      // Fallback to mock
      return await this._extractLocationMock(description);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.externalService('Gemini', 'extractLocation', false, responseTime, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Mock location extraction for testing
   */
  async _extractLocationMock(description) {
    // Simple regex-based location extraction for mock
    const locationPatterns = [
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2}|[A-Z][a-z]+)/g,
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd)/gi,
      /\b(?:in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi
    ];

    const locations = new Set();
    
    locationPatterns.forEach(pattern => {
      const matches = description.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          locations.add(match[1].trim());
        }
      }
    });

    // Add some common disaster-related locations if found in text
    const commonLocations = {
      'manhattan': 'Manhattan, NYC',
      'brooklyn': 'Brooklyn, NYC',
      'queens': 'Queens, NYC',
      'bronx': 'Bronx, NYC',
      'miami': 'Miami, FL',
      'houston': 'Houston, TX',
      'los angeles': 'Los Angeles, CA',
      'chicago': 'Chicago, IL'
    };

    const lowerDescription = description.toLowerCase();
    Object.keys(commonLocations).forEach(key => {
      if (lowerDescription.includes(key)) {
        locations.add(commonLocations[key]);
      }
    });

    const result = Array.from(locations);
    
    logger.externalService('Gemini', 'extractLocation', true, 100, {
      locationsFound: result.length,
      source: 'mock'
    });

    return { locations: result, source: 'mock' };
  }

  /**
   * Verify disaster image authenticity
   */
  async verifyImage(imageUrl) {
    const cacheKey = `gemini_verify_${Buffer.from(imageUrl).toString('base64').slice(0, 50)}`;
    
    try {
      // Check cache first
      const cachedResult = await getCachedData(cacheKey);
      if (cachedResult) {
        logger.cacheOperation('hit', cacheKey, true);
        return cachedResult;
      }

      logger.cacheOperation('miss', cacheKey, false);

      let result;
      if (this.apiKey) {
        result = await this._verifyImageWithAPI(imageUrl);
      } else {
        result = await this._verifyImageMock(imageUrl);
      }

      // Cache the result
      await setCachedData(cacheKey, result, 1);
      
      return result;
    } catch (error) {
      logger.externalService('Gemini', 'verifyImage', false, 0, { error: error.message });
      
      // Fallback to mock response
      return await this._verifyImageMock(imageUrl);
    }
  }

  /**
   * Verify image using Gemini Vision API
   */
  async _verifyImageWithAPI(imageUrl) {
    const startTime = Date.now();
    
    try {
      const prompt = `Analyze this image for signs of disaster or emergency situation. Determine if the image appears to be authentic and related to a real disaster/emergency. Look for signs of manipulation, inconsistencies, or if it appears to be from a movie/game/simulation.

Return your analysis as JSON with the following structure:
{
  "isAuthentic": boolean,
  "confidence": number (0-100),
  "disasterType": string or null,
  "reasoning": string,
  "manipulationSigns": array of strings
}`;

      // Note: This is a simplified example. In practice, you'd need to handle image data properly
      const response = await retryWithBackoff(async () => {
        return await axios.post(
          `${this.baseUrl}/models/gemini-pro-vision:generateContent?key=${this.apiKey}`,
          {
            contents: [{
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: imageUrl // In practice, you'd need to fetch and encode the image
                  }
                }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              topK: 1,
              topP: 1,
              maxOutputTokens: 512,
            }
          },
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        );
      });

      const responseTime = Date.now() - startTime;
      
      if (response.data && response.data.candidates && response.data.candidates[0]) {
        const text = response.data.candidates[0].content.parts[0].text.trim();
        
        try {
          const analysis = JSON.parse(text);
          logger.externalService('Gemini', 'verifyImage', true, responseTime, {
            isAuthentic: analysis.isAuthentic,
            confidence: analysis.confidence
          });
          return { ...analysis, source: 'gemini' };
        } catch (parseError) {
          // If JSON parsing fails, create a basic analysis
          const isAuthentic = !text.toLowerCase().includes('fake') && !text.toLowerCase().includes('manipulated');
          logger.externalService('Gemini', 'verifyImage', true, responseTime, {
            isAuthentic,
            parseMethod: 'text'
          });
          return {
            isAuthentic,
            confidence: 70,
            disasterType: null,
            reasoning: text,
            manipulationSigns: [],
            source: 'gemini'
          };
        }
      }

      logger.externalService('Gemini', 'verifyImage', false, responseTime, {
        error: 'No valid response from API'
      });
      
      // Fallback to mock
      return await this._verifyImageMock(imageUrl);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.externalService('Gemini', 'verifyImage', false, responseTime, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Mock image verification for testing
   */
  async _verifyImageMock(imageUrl) {
    // Mock analysis based on URL patterns
    const isAuthentic = !imageUrl.includes('fake') && !imageUrl.includes('test') && !imageUrl.includes('mock');
    const confidence = Math.floor(Math.random() * 30) + 70; // 70-100
    
    const disasterTypes = ['flood', 'fire', 'earthquake', 'storm', 'accident'];
    const disasterType = disasterTypes[Math.floor(Math.random() * disasterTypes.length)];
    
    const result = {
      isAuthentic,
      confidence,
      disasterType: isAuthentic ? disasterType : null,
      reasoning: isAuthentic 
        ? `Image appears to show genuine ${disasterType} damage and conditions consistent with disaster scenarios.`
        : 'Image shows signs of potential manipulation or inconsistencies.',
      manipulationSigns: isAuthentic ? [] : ['Inconsistent lighting', 'Unusual artifacts'],
      source: 'mock'
    };

    logger.externalService('Gemini', 'verifyImage', true, 200, {
      isAuthentic,
      confidence,
      source: 'mock'
    });

    return result;
  }

  /**
   * Parse location text when JSON parsing fails
   */
  _parseLocationText(text) {
    const locations = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      const cleaned = line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim();
      if (cleaned && cleaned.length > 2 && cleaned.length < 100) {
        locations.push(cleaned);
      }
    });
    
    return locations.slice(0, 10); // Limit to 10 locations
  }
}

module.exports = new GeminiService();
