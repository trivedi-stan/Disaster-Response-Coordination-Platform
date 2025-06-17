const axios = require('axios');
const logger = require('../utils/logger');
const { getCachedData, setCachedData } = require('../config/database');
const { retryWithBackoff, calculateDisasterPriority } = require('../utils/helpers');

class SocialMediaService {
  constructor() {
    this.twitterBearerToken = process.env.TWITTER_BEARER_TOKEN;
    this.blueskyIdentifier = process.env.BLUESKY_IDENTIFIER;
    this.blueskyPassword = process.env.BLUESKY_PASSWORD;
    
    // Determine which service to use
    this.service = this.twitterBearerToken ? 'twitter' : 
                   (this.blueskyIdentifier && this.blueskyPassword) ? 'bluesky' : 'mock';
    
    logger.info(`Social media service initialized: ${this.service}`);
  }

  /**
   * Fetch social media reports for a disaster
   */
  async fetchReports(disasterId, keywords = [], location = null) {
    const cacheKey = `social_media_${disasterId}_${keywords.join('_')}`;
    
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
        case 'twitter':
          result = await this._fetchFromTwitter(keywords, location);
          break;
        case 'bluesky':
          result = await this._fetchFromBluesky(keywords, location);
          break;
        default:
          result = await this._fetchMockReports(keywords, location);
      }

      // Process and enhance the reports
      const processedReports = this._processReports(result.reports, disasterId);
      
      const finalResult = {
        ...result,
        reports: processedReports,
        disasterId,
        fetchedAt: new Date().toISOString()
      };

      // Cache the result for 10 minutes (social media data changes frequently)
      await setCachedData(cacheKey, finalResult, 0.17); // 10 minutes
      
      return finalResult;
    } catch (error) {
      logger.externalService(this.service, 'fetchReports', false, 0, { 
        error: error.message,
        disasterId,
        keywords 
      });
      
      // Fallback to mock response
      return await this._fetchMockReports(keywords, location, disasterId);
    }
  }

  /**
   * Fetch reports from Twitter API
   */
  async _fetchFromTwitter(keywords, location) {
    const startTime = Date.now();
    
    try {
      // Build search query
      let query = keywords.length > 0 ? keywords.map(k => `#${k}`).join(' OR ') : '#disaster OR #emergency';
      
      // Add location filter if provided
      if (location && location.lat && location.lng) {
        query += ` geocode:${location.lat},${location.lng},10km`;
      }

      const response = await retryWithBackoff(async () => {
        return await axios.get('https://api.twitter.com/2/tweets/search/recent', {
          params: {
            query,
            max_results: 50,
            'tweet.fields': 'created_at,author_id,public_metrics,context_annotations,geo',
            'user.fields': 'username,name,verified',
            expansions: 'author_id'
          },
          headers: {
            'Authorization': `Bearer ${this.twitterBearerToken}`
          },
          timeout: 15000
        });
      });

      const responseTime = Date.now() - startTime;

      if (response.data && response.data.data) {
        const reports = response.data.data.map(tweet => ({
          id: tweet.id,
          platform: 'twitter',
          content: tweet.text,
          author: this._getTwitterAuthor(tweet.author_id, response.data.includes?.users),
          createdAt: tweet.created_at,
          metrics: tweet.public_metrics,
          location: tweet.geo,
          url: `https://twitter.com/user/status/${tweet.id}`
        }));

        logger.externalService('Twitter', 'fetchReports', true, responseTime, {
          reportsFound: reports.length,
          keywords
        });

        return {
          reports,
          source: 'twitter',
          totalFound: response.data.meta?.result_count || reports.length
        };
      } else {
        throw new Error('No data returned from Twitter API');
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.externalService('Twitter', 'fetchReports', false, responseTime, {
        error: error.message,
        keywords
      });
      throw error;
    }
  }

  /**
   * Fetch reports from Bluesky API
   */
  async _fetchFromBluesky(keywords, location) {
    const startTime = Date.now();
    
    try {
      // Note: This is a simplified example. Bluesky API implementation would need proper authentication
      const query = keywords.length > 0 ? keywords.join(' ') : 'disaster emergency';
      
      const response = await retryWithBackoff(async () => {
        return await axios.get('https://bsky.social/xrpc/app.bsky.feed.searchPosts', {
          params: {
            q: query,
            limit: 50
          },
          timeout: 15000
        });
      });

      const responseTime = Date.now() - startTime;

      if (response.data && response.data.posts) {
        const reports = response.data.posts.map(post => ({
          id: post.uri,
          platform: 'bluesky',
          content: post.record.text,
          author: post.author.displayName || post.author.handle,
          createdAt: post.record.createdAt,
          metrics: {
            replyCount: post.replyCount || 0,
            repostCount: post.repostCount || 0,
            likeCount: post.likeCount || 0
          },
          url: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`
        }));

        logger.externalService('Bluesky', 'fetchReports', true, responseTime, {
          reportsFound: reports.length,
          keywords
        });

        return {
          reports,
          source: 'bluesky',
          totalFound: reports.length
        };
      } else {
        throw new Error('No data returned from Bluesky API');
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.externalService('Bluesky', 'fetchReports', false, responseTime, {
        error: error.message,
        keywords
      });
      throw error;
    }
  }

  /**
   * Generate mock social media reports for testing
   */
  async _fetchMockReports(keywords, location, disasterId) {
    const mockReports = [
      {
        id: 'mock_1',
        platform: 'mock_twitter',
        content: '#floodrelief Need food and water in Lower East Side. Families trapped on 3rd floor. #emergency #NYC',
        author: 'citizen_reporter1',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
        metrics: { replyCount: 5, retweetCount: 12, likeCount: 8 },
        url: 'https://twitter.com/mock/status/1'
      },
      {
        id: 'mock_2',
        platform: 'mock_twitter',
        content: 'Shelter available at Community Center on Main St. Can accommodate 50 people. #disasterrelief #shelter',
        author: 'relief_org_official',
        createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes ago
        metrics: { replyCount: 2, retweetCount: 25, likeCount: 15 },
        url: 'https://twitter.com/mock/status/2'
      },
      {
        id: 'mock_3',
        platform: 'mock_twitter',
        content: 'URGENT: Medical assistance needed at 123 Oak Street. Elderly person trapped. #SOS #medical #emergency',
        author: 'first_responder',
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
        metrics: { replyCount: 8, retweetCount: 35, likeCount: 20 },
        url: 'https://twitter.com/mock/status/3'
      },
      {
        id: 'mock_4',
        platform: 'mock_twitter',
        content: 'Power restored to downtown area. Water still not safe to drink. Boil water advisory in effect. #update',
        author: 'city_emergency_mgmt',
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        metrics: { replyCount: 15, retweetCount: 45, likeCount: 30 },
        url: 'https://twitter.com/mock/status/4'
      },
      {
        id: 'mock_5',
        platform: 'mock_twitter',
        content: 'Volunteers needed at Red Cross center. Bring supplies if possible. #volunteer #help #disaster',
        author: 'volunteer_coordinator',
        createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(), // 1.5 hours ago
        metrics: { replyCount: 3, retweetCount: 18, likeCount: 12 },
        url: 'https://twitter.com/mock/status/5'
      }
    ];

    // Filter reports based on keywords if provided
    let filteredReports = mockReports;
    if (keywords.length > 0) {
      filteredReports = mockReports.filter(report => 
        keywords.some(keyword => 
          report.content.toLowerCase().includes(keyword.toLowerCase())
        )
      );
    }

    logger.externalService('Mock Social Media', 'fetchReports', true, 100, {
      reportsFound: filteredReports.length,
      keywords,
      source: 'mock'
    });

    return {
      reports: filteredReports,
      source: 'mock',
      totalFound: filteredReports.length,
      disasterId,
      fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Process and enhance social media reports
   */
  _processReports(reports, disasterId) {
    return reports.map(report => {
      // Extract potential locations from content
      const locationMatches = this._extractLocationsFromText(report.content);
      
      // Calculate priority score based on content
      const priorityScore = this._calculatePriorityScore(report.content);
      
      // Determine sentiment
      const sentiment = this._analyzeSentiment(report.content);
      
      // Categorize the report
      const category = this._categorizeReport(report.content);

      return {
        ...report,
        disasterId,
        locationExtracted: locationMatches.length > 0 ? locationMatches[0] : null,
        allLocations: locationMatches,
        priorityScore,
        sentiment,
        category,
        processedAt: new Date().toISOString()
      };
    });
  }

  /**
   * Extract locations from text content
   */
  _extractLocationsFromText(text) {
    const locationPatterns = [
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln)\b/gi,
      /\b(?:at|on|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2}|[A-Z][a-z]+)\b/g
    ];

    const locations = new Set();
    
    locationPatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          locations.add(match[1].trim());
        }
      }
    });

    return Array.from(locations);
  }

  /**
   * Calculate priority score for a report
   */
  _calculatePriorityScore(content) {
    const urgentKeywords = ['urgent', 'sos', 'emergency', 'trapped', 'medical', 'help', 'critical'];
    const moderateKeywords = ['need', 'assistance', 'shelter', 'food', 'water', 'supplies'];
    const lowKeywords = ['update', 'info', 'volunteer', 'available'];

    const text = content.toLowerCase();
    
    let score = 1;
    
    urgentKeywords.forEach(keyword => {
      if (text.includes(keyword)) score += 3;
    });
    
    moderateKeywords.forEach(keyword => {
      if (text.includes(keyword)) score += 2;
    });
    
    lowKeywords.forEach(keyword => {
      if (text.includes(keyword)) score += 1;
    });

    return Math.min(10, score); // Cap at 10
  }

  /**
   * Analyze sentiment of the report
   */
  _analyzeSentiment(content) {
    const negativeWords = ['help', 'trapped', 'emergency', 'urgent', 'disaster', 'damage', 'destroyed', 'need'];
    const positiveWords = ['safe', 'rescued', 'available', 'restored', 'volunteer', 'helping'];
    
    const text = content.toLowerCase();
    let negativeCount = 0;
    let positiveCount = 0;
    
    negativeWords.forEach(word => {
      if (text.includes(word)) negativeCount++;
    });
    
    positiveWords.forEach(word => {
      if (text.includes(word)) positiveCount++;
    });
    
    if (negativeCount > positiveCount) return 'negative';
    if (positiveCount > negativeCount) return 'positive';
    return 'neutral';
  }

  /**
   * Categorize the report based on content
   */
  _categorizeReport(content) {
    const categories = {
      'medical': ['medical', 'injured', 'hospital', 'ambulance', 'doctor'],
      'shelter': ['shelter', 'housing', 'accommodation', 'place to stay'],
      'food_water': ['food', 'water', 'hungry', 'thirsty', 'supplies'],
      'rescue': ['trapped', 'rescue', 'stuck', 'help', 'sos'],
      'information': ['update', 'info', 'status', 'news', 'report'],
      'volunteer': ['volunteer', 'helping', 'assist', 'support'],
      'infrastructure': ['power', 'electricity', 'road', 'bridge', 'water system']
    };

    const text = content.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }
    
    return 'general';
  }

  /**
   * Get Twitter author information
   */
  _getTwitterAuthor(authorId, users) {
    if (!users) return 'Unknown User';
    
    const user = users.find(u => u.id === authorId);
    return user ? `${user.name} (@${user.username})` : 'Unknown User';
  }
}

module.exports = new SocialMediaService();
