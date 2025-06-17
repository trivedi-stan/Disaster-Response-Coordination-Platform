const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

let supabase = null;

const connectSupabase = async () => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    // Check if Supabase credentials are configured
    if (!supabaseUrl || supabaseUrl === 'your_supabase_project_url' ||
      !supabaseKey || supabaseKey === 'your_supabase_service_role_key' || supabaseKey === 'your_supabase_anon_key') {
      logger.warn('Supabase credentials not configured. Running in mock mode.');
      logger.warn('To enable database functionality, configure SUPABASE_URL and SUPABASE_SERVICE_KEY in .env file');
      return null;
    }

    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Test connection
    const { data, error } = await supabase.from('disasters').select('count', { count: 'exact', head: true });

    if (error && error.code !== 'PGRST116') { // PGRST116 is "relation does not exist" which is expected for new setup
      logger.warn('Supabase connection failed, running in mock mode:', error.message);
      return null;
    }

    logger.info('Supabase connection established successfully');
    return supabase;
  } catch (error) {
    logger.warn('Failed to connect to Supabase, running in mock mode:', error.message);
    return null;
  }
};

const getSupabase = () => {
  return supabase; // Can be null if not configured
};

// Database initialization SQL
const initializeTables = async () => {
  const supabase = getSupabase();

  const createTablesSQL = `
    -- Enable PostGIS extension for geospatial support
    CREATE EXTENSION IF NOT EXISTS postgis;
    
    -- Create disasters table
    CREATE TABLE IF NOT EXISTS disasters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      location_name TEXT,
      location GEOGRAPHY(POINT, 4326),
      description TEXT,
      tags TEXT[] DEFAULT '{}',
      owner_id TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      audit_trail JSONB DEFAULT '[]'::jsonb
    );
    
    -- Create reports table
    CREATE TABLE IF NOT EXISTS reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      disaster_id UUID REFERENCES disasters(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      content TEXT,
      image_url TEXT,
      verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Create resources table
    CREATE TABLE IF NOT EXISTS resources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      disaster_id UUID REFERENCES disasters(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      location_name TEXT,
      location GEOGRAPHY(POINT, 4326),
      type TEXT NOT NULL,
      description TEXT,
      contact_info JSONB,
      capacity INTEGER,
      availability_status TEXT DEFAULT 'available' CHECK (availability_status IN ('available', 'full', 'unavailable')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Create cache table
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Create social_media_reports table
    CREATE TABLE IF NOT EXISTS social_media_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      disaster_id UUID REFERENCES disasters(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      post_id TEXT,
      content TEXT NOT NULL,
      author TEXT,
      location_extracted TEXT,
      location GEOGRAPHY(POINT, 4326),
      sentiment TEXT,
      priority_score INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Create official_updates table
    CREATE TABLE IF NOT EXISTS official_updates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      disaster_id UUID REFERENCES disasters(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      url TEXT,
      published_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS disasters_location_idx ON disasters USING GIST (location);
    CREATE INDEX IF NOT EXISTS disasters_tags_idx ON disasters USING GIN (tags);
    CREATE INDEX IF NOT EXISTS disasters_owner_id_idx ON disasters (owner_id);
    CREATE INDEX IF NOT EXISTS disasters_created_at_idx ON disasters (created_at DESC);
    
    CREATE INDEX IF NOT EXISTS resources_location_idx ON resources USING GIST (location);
    CREATE INDEX IF NOT EXISTS resources_disaster_id_idx ON resources (disaster_id);
    CREATE INDEX IF NOT EXISTS resources_type_idx ON resources (type);
    
    CREATE INDEX IF NOT EXISTS reports_disaster_id_idx ON reports (disaster_id);
    CREATE INDEX IF NOT EXISTS reports_user_id_idx ON reports (user_id);
    CREATE INDEX IF NOT EXISTS reports_verification_status_idx ON reports (verification_status);
    
    CREATE INDEX IF NOT EXISTS cache_expires_at_idx ON cache (expires_at);
    
    CREATE INDEX IF NOT EXISTS social_media_reports_disaster_id_idx ON social_media_reports (disaster_id);
    CREATE INDEX IF NOT EXISTS social_media_reports_location_idx ON social_media_reports USING GIST (location);
    CREATE INDEX IF NOT EXISTS social_media_reports_created_at_idx ON social_media_reports (created_at DESC);
    
    CREATE INDEX IF NOT EXISTS official_updates_disaster_id_idx ON official_updates (disaster_id);
    CREATE INDEX IF NOT EXISTS official_updates_source_idx ON official_updates (source);
    CREATE INDEX IF NOT EXISTS official_updates_published_at_idx ON official_updates (published_at DESC);
    
    -- Create updated_at trigger function
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ language 'plpgsql';
    
    -- Create triggers for updated_at
    DROP TRIGGER IF EXISTS update_disasters_updated_at ON disasters;
    CREATE TRIGGER update_disasters_updated_at BEFORE UPDATE ON disasters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
    DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
    CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
    DROP TRIGGER IF EXISTS update_resources_updated_at ON resources;
    CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON resources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `;

  try {
    // Note: For production, you would run these SQL commands directly in Supabase dashboard
    // or use a migration tool. For this demo, we'll log the SQL for manual execution.
    logger.info('Database initialization SQL ready. Please run the following SQL in your Supabase dashboard:');
    logger.info(createTablesSQL);

    return true;
  } catch (error) {
    logger.error('Failed to initialize database tables:', error);
    throw error;
  }
};

// Cache management functions
const getCachedData = async (key) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return null; // No caching in mock mode
    }

    const { data, error } = await supabase
      .from('cache')
      .select('value, expires_at')
      .eq('key', key)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if cache has expired
    if (new Date(data.expires_at) < new Date()) {
      // Delete expired cache entry
      await supabase.from('cache').delete().eq('key', key);
      return null;
    }

    return data.value;
  } catch (error) {
    logger.error('Error getting cached data:', error);
    return null;
  }
};

const setCachedData = async (key, value, ttlHours = 1) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return; // No caching in mock mode
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    const { error } = await supabase
      .from('cache')
      .upsert({
        key,
        value,
        expires_at: expiresAt.toISOString()
      });

    if (error) {
      logger.error('Error setting cached data:', error);
    }
  } catch (error) {
    logger.error('Error setting cached data:', error);
  }
};

const clearExpiredCache = async () => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('cache')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) {
      logger.error('Error clearing expired cache:', error);
    } else {
      logger.info('Expired cache entries cleared');
    }
  } catch (error) {
    logger.error('Error clearing expired cache:', error);
  }
};

module.exports = {
  connectSupabase,
  getSupabase,
  initializeTables,
  getCachedData,
  setCachedData,
  clearExpiredCache
};
