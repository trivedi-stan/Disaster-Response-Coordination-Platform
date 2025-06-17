const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');
const { getCachedData, setCachedData } = require('../config/database');
const { retryWithBackoff } = require('../utils/helpers');

class OfficialUpdatesService {
  constructor() {
    this.sources = [
      {
        name: 'FEMA',
        url: 'https://www.fema.gov/disaster/current',
        selectors: {
          title: '.field--name-title a',
          content: '.field--name-body p',
          date: '.field--name-created time',
          link: '.field--name-title a'
        }
      },
      {
        name: 'Red Cross',
        url: 'https://www.redcross.org/about-us/news-and-events',
        selectors: {
          title: '.news-item h3 a',
          content: '.news-item .excerpt',
          date: '.news-item .date',
          link: '.news-item h3 a'
        }
      },
      {
        name: 'National Weather Service',
        url: 'https://www.weather.gov/alerts',
        selectors: {
          title: '.alert-title',
          content: '.alert-description',
          date: '.alert-date',
          link: '.alert-title a'
        }
      }
    ];
  }

  /**
   * Fetch official updates for a disaster
   */
  async fetchUpdates(disasterId, keywords = []) {
    const cacheKey = `official_updates_${disasterId}_${keywords.join('_')}`;
    
    try {
      // Check cache first
      const cachedResult = await getCachedData(cacheKey);
      if (cachedResult) {
        logger.cacheOperation('hit', cacheKey, true);
        return cachedResult;
      }

      logger.cacheOperation('miss', cacheKey, false);

      // Fetch from all sources
      const allUpdates = [];
      
      for (const source of this.sources) {
        try {
          const updates = await this._fetchFromSource(source, keywords);
          allUpdates.push(...updates);
        } catch (error) {
          logger.warn(`Failed to fetch from ${source.name}:`, { error: error.message });
          // Continue with other sources
        }
      }

      // Add mock updates for demonstration
      const mockUpdates = await this._fetchMockUpdates(keywords);
      allUpdates.push(...mockUpdates);

      // Sort by date (newest first)
      allUpdates.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

      const result = {
        updates: allUpdates,
        disasterId,
        fetchedAt: new Date().toISOString(),
        totalFound: allUpdates.length
      };

      // Cache the result for 1 hour
      await setCachedData(cacheKey, result, 1);
      
      return result;
    } catch (error) {
      logger.externalService('Official Updates', 'fetchUpdates', false, 0, { 
        error: error.message,
        disasterId,
        keywords 
      });
      
      // Fallback to mock response
      return await this._fetchMockUpdates(keywords, disasterId);
    }
  }

  /**
   * Fetch updates from a specific source
   */
  async _fetchFromSource(source, keywords) {
    const startTime = Date.now();
    
    try {
      const response = await retryWithBackoff(async () => {
        return await axios.get(source.url, {
          headers: {
            'User-Agent': 'DisasterResponsePlatform/1.0 (Emergency Management System)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          timeout: 15000
        });
      });

      const responseTime = Date.now() - startTime;
      const $ = cheerio.load(response.data);
      const updates = [];

      // Extract updates based on selectors
      $(source.selectors.title).each((index, element) => {
        if (index >= 10) return false; // Limit to 10 updates per source

        const title = $(element).text().trim();
        const link = $(element).attr('href');
        
        // Find corresponding content and date
        const contentElement = $(element).closest('.news-item, .alert-item, article').find(source.selectors.content).first();
        const dateElement = $(element).closest('.news-item, .alert-item, article').find(source.selectors.date).first();
        
        const content = contentElement.text().trim();
        const dateText = dateElement.text().trim() || dateElement.attr('datetime');
        
        // Filter by keywords if provided
        if (keywords.length > 0) {
          const searchText = (title + ' ' + content).toLowerCase();
          const hasKeyword = keywords.some(keyword => 
            searchText.includes(keyword.toLowerCase())
          );
          if (!hasKeyword) return;
        }

        updates.push({
          id: `${source.name.toLowerCase()}_${index}`,
          source: source.name,
          title,
          content: content || title,
          url: this._resolveUrl(link, source.url),
          publishedAt: this._parseDate(dateText),
          fetchedAt: new Date().toISOString()
        });
      });

      logger.externalService(source.name, 'fetchUpdates', true, responseTime, {
        updatesFound: updates.length,
        keywords
      });

      return updates;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.externalService(source.name, 'fetchUpdates', false, responseTime, {
        error: error.message,
        keywords
      });
      throw error;
    }
  }

  /**
   * Generate mock official updates for testing
   */
  async _fetchMockUpdates(keywords, disasterId) {
    const mockUpdates = [
      {
        id: 'fema_mock_1',
        source: 'FEMA',
        title: 'Federal Disaster Declaration Approved for Flood-Affected Areas',
        content: 'FEMA has approved federal disaster assistance for individuals and communities affected by recent flooding. Residents can now apply for temporary housing assistance, home repairs, and other disaster-related expenses.',
        url: 'https://www.fema.gov/disaster/mock-declaration-1',
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        fetchedAt: new Date().toISOString()
      },
      {
        id: 'redcross_mock_1',
        source: 'Red Cross',
        title: 'Emergency Shelters Open in Affected Communities',
        content: 'The American Red Cross has opened emergency shelters in three locations to provide safe housing for displaced families. Shelters are equipped with food, water, and basic necessities.',
        url: 'https://www.redcross.org/mock-shelter-update-1',
        publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
        fetchedAt: new Date().toISOString()
      },
      {
        id: 'nws_mock_1',
        source: 'National Weather Service',
        title: 'Flash Flood Warning Extended Through Tomorrow',
        content: 'The National Weather Service has extended the flash flood warning for the metropolitan area through tomorrow evening. Residents are advised to avoid travel in low-lying areas and never drive through flooded roads.',
        url: 'https://www.weather.gov/mock-flood-warning-1',
        publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        fetchedAt: new Date().toISOString()
      },
      {
        id: 'local_emergency_mock_1',
        source: 'Local Emergency Management',
        title: 'Water Distribution Points Established',
        content: 'Local emergency management has established water distribution points at three locations throughout the city. Each family can receive up to 5 gallons of drinking water per day.',
        url: 'https://local-emergency.gov/mock-water-distribution',
        publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
        fetchedAt: new Date().toISOString()
      },
      {
        id: 'utility_company_mock_1',
        source: 'Utility Company',
        title: 'Power Restoration Update - 75% of Customers Restored',
        content: 'Power has been restored to 75% of affected customers. Crews are working around the clock to restore service to remaining areas. Full restoration expected within 48 hours.',
        url: 'https://utility-company.com/mock-power-update',
        publishedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(), // 10 hours ago
        fetchedAt: new Date().toISOString()
      }
    ];

    // Filter updates based on keywords if provided
    let filteredUpdates = mockUpdates;
    if (keywords.length > 0) {
      filteredUpdates = mockUpdates.filter(update => 
        keywords.some(keyword => 
          update.title.toLowerCase().includes(keyword.toLowerCase()) ||
          update.content.toLowerCase().includes(keyword.toLowerCase())
        )
      );
    }

    logger.externalService('Mock Official Updates', 'fetchUpdates', true, 100, {
      updatesFound: filteredUpdates.length,
      keywords,
      source: 'mock'
    });

    return {
      updates: filteredUpdates,
      disasterId,
      fetchedAt: new Date().toISOString(),
      totalFound: filteredUpdates.length
    };
  }

  /**
   * Resolve relative URLs to absolute URLs
   */
  _resolveUrl(link, baseUrl) {
    if (!link) return baseUrl;
    
    if (link.startsWith('http')) {
      return link;
    }
    
    const base = new URL(baseUrl);
    if (link.startsWith('/')) {
      return `${base.protocol}//${base.host}${link}`;
    }
    
    return `${base.protocol}//${base.host}${base.pathname}/${link}`;
  }

  /**
   * Parse date from various formats
   */
  _parseDate(dateText) {
    if (!dateText) {
      return new Date().toISOString();
    }

    // Try to parse the date
    const date = new Date(dateText);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }

    // Handle relative dates like "2 hours ago"
    const relativeMatch = dateText.match(/(\d+)\s+(minute|hour|day)s?\s+ago/i);
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1]);
      const unit = relativeMatch[2].toLowerCase();
      const now = new Date();
      
      switch (unit) {
        case 'minute':
          now.setMinutes(now.getMinutes() - amount);
          break;
        case 'hour':
          now.setHours(now.getHours() - amount);
          break;
        case 'day':
          now.setDate(now.getDate() - amount);
          break;
      }
      
      return now.toISOString();
    }

    // Default to current time if parsing fails
    return new Date().toISOString();
  }

  /**
   * Fetch updates from RSS feeds (alternative method)
   */
  async _fetchFromRSS(rssUrl, sourceName) {
    try {
      const response = await axios.get(rssUrl, {
        headers: {
          'User-Agent': 'DisasterResponsePlatform/1.0'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data, { xmlMode: true });
      const updates = [];

      $('item').each((index, element) => {
        if (index >= 10) return false; // Limit to 10 items

        const title = $(element).find('title').text().trim();
        const content = $(element).find('description').text().trim();
        const link = $(element).find('link').text().trim();
        const pubDate = $(element).find('pubDate').text().trim();

        updates.push({
          id: `${sourceName.toLowerCase()}_rss_${index}`,
          source: sourceName,
          title,
          content,
          url: link,
          publishedAt: new Date(pubDate).toISOString(),
          fetchedAt: new Date().toISOString()
        });
      });

      return updates;
    } catch (error) {
      logger.error(`Failed to fetch RSS from ${sourceName}:`, error);
      return [];
    }
  }

  /**
   * Get available sources
   */
  getAvailableSources() {
    return this.sources.map(source => ({
      name: source.name,
      url: source.url
    }));
  }
}

module.exports = new OfficialUpdatesService();
