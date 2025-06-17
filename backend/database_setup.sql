-- Disaster Response Coordination Platform Database Setup
-- Run this SQL in your Supabase SQL Editor

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
CREATE INDEX IF NOT EXISTS social_media_reports_priority_idx ON social_media_reports (priority_score DESC);

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

-- Create geospatial helper functions
CREATE OR REPLACE FUNCTION resources_within_radius(
  center_lat FLOAT,
  center_lng FLOAT,
  radius_meters FLOAT,
  disaster_uuid UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  disaster_id UUID,
  name TEXT,
  location_name TEXT,
  location GEOGRAPHY,
  type TEXT,
  description TEXT,
  contact_info JSONB,
  capacity INTEGER,
  availability_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  distance_meters FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.disaster_id,
    r.name,
    r.location_name,
    r.location,
    r.type,
    r.description,
    r.contact_info,
    r.capacity,
    r.availability_status,
    r.created_at,
    r.updated_at,
    ST_Distance(r.location, ST_SetSRID(ST_Point(center_lng, center_lat), 4326)) as distance_meters
  FROM resources r
  WHERE 
    ST_DWithin(r.location, ST_SetSRID(ST_Point(center_lng, center_lat), 4326), radius_meters)
    AND (disaster_uuid IS NULL OR r.disaster_id = disaster_uuid)
  ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql;

-- Create function to find nearby disasters
CREATE OR REPLACE FUNCTION disasters_within_radius(
  center_lat FLOAT,
  center_lng FLOAT,
  radius_meters FLOAT
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  location_name TEXT,
  location GEOGRAPHY,
  description TEXT,
  tags TEXT[],
  owner_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  distance_meters FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.title,
    d.location_name,
    d.location,
    d.description,
    d.tags,
    d.owner_id,
    d.created_at,
    d.updated_at,
    ST_Distance(d.location, ST_SetSRID(ST_Point(center_lng, center_lat), 4326)) as distance_meters
  FROM disasters d
  WHERE 
    d.location IS NOT NULL
    AND ST_DWithin(d.location, ST_SetSRID(ST_Point(center_lng, center_lat), 4326), radius_meters)
  ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql;

-- Insert sample data for testing
INSERT INTO disasters (title, location_name, location, description, tags, owner_id) VALUES
(
  'NYC Flood Emergency',
  'Manhattan, NYC',
  ST_SetSRID(ST_Point(-73.9712, 40.7831), 4326),
  'Heavy flooding in Manhattan due to storm surge. Multiple streets underwater.',
  ARRAY['flood', 'urgent', 'storm'],
  'netrunnerX'
),
(
  'California Wildfire',
  'Los Angeles, CA',
  ST_SetSRID(ST_Point(-118.2437, 34.0522), 4326),
  'Large wildfire spreading rapidly through residential areas.',
  ARRAY['wildfire', 'evacuation', 'urgent'],
  'reliefAdmin'
),
(
  'Hurricane Preparedness',
  'Miami, FL',
  ST_SetSRID(ST_Point(-80.1918, 25.7617), 4326),
  'Category 3 hurricane approaching. Evacuation orders in effect.',
  ARRAY['hurricane', 'evacuation', 'emergency'],
  'netrunnerX'
);

-- Insert sample resources
INSERT INTO resources (disaster_id, name, location_name, location, type, description, capacity) VALUES
(
  (SELECT id FROM disasters WHERE title = 'NYC Flood Emergency' LIMIT 1),
  'Red Cross Emergency Shelter',
  'Lower East Side, NYC',
  ST_SetSRID(ST_Point(-73.9857, 40.7142), 4326),
  'shelter',
  'Emergency shelter with food and medical supplies',
  200
),
(
  (SELECT id FROM disasters WHERE title = 'NYC Flood Emergency' LIMIT 1),
  'Community Food Bank',
  'Brooklyn, NYC',
  ST_SetSRID(ST_Point(-73.9442, 40.6782), 4326),
  'food',
  'Food distribution center for flood victims',
  500
),
(
  (SELECT id FROM disasters WHERE title = 'California Wildfire' LIMIT 1),
  'Evacuation Center',
  'Pasadena, CA',
  ST_SetSRID(ST_Point(-118.1445, 34.1478), 4326),
  'shelter',
  'Temporary evacuation center for wildfire evacuees',
  300
);

-- Insert sample reports
INSERT INTO reports (disaster_id, user_id, content, verification_status) VALUES
(
  (SELECT id FROM disasters WHERE title = 'NYC Flood Emergency' LIMIT 1),
  'citizen1',
  'Water level rising rapidly on 14th Street. Need immediate assistance.',
  'pending'
),
(
  (SELECT id FROM disasters WHERE title = 'California Wildfire' LIMIT 1),
  'responder1',
  'Fire has jumped the highway. Evacuation route compromised.',
  'verified'
);

-- Create a function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean cache (if pg_cron is available)
-- SELECT cron.schedule('clean-cache', '0 * * * *', 'SELECT clean_expired_cache();');

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Create RLS (Row Level Security) policies if needed
-- ALTER TABLE disasters ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- Example RLS policy (uncomment and modify as needed)
-- CREATE POLICY "Users can view all disasters" ON disasters FOR SELECT USING (true);
-- CREATE POLICY "Users can create disasters" ON disasters FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Users can update own disasters" ON disasters FOR UPDATE USING (owner_id = current_user);

COMMENT ON TABLE disasters IS 'Main disasters table with geospatial location support';
COMMENT ON TABLE resources IS 'Resources available for disaster response with geospatial queries';
COMMENT ON TABLE social_media_reports IS 'Social media reports aggregated from various platforms';
COMMENT ON TABLE official_updates IS 'Official updates from government and relief organizations';
COMMENT ON TABLE cache IS 'Caching table for external API responses with TTL support';

-- Create view for disaster statistics
CREATE OR REPLACE VIEW disaster_stats AS
SELECT 
  COUNT(*) as total_disasters,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as disasters_last_24h,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as disasters_last_week,
  COUNT(DISTINCT owner_id) as unique_reporters,
  array_agg(DISTINCT unnest(tags)) as all_tags
FROM disasters;

-- Create view for resource availability
CREATE OR REPLACE VIEW resource_availability AS
SELECT 
  type,
  COUNT(*) as total_resources,
  COUNT(*) FILTER (WHERE availability_status = 'available') as available_resources,
  COUNT(*) FILTER (WHERE availability_status = 'full') as full_resources,
  COUNT(*) FILTER (WHERE availability_status = 'unavailable') as unavailable_resources,
  SUM(capacity) FILTER (WHERE capacity IS NOT NULL) as total_capacity
FROM resources
GROUP BY type;

COMMENT ON VIEW disaster_stats IS 'Statistics view for disaster data';
COMMENT ON VIEW resource_availability IS 'Resource availability summary by type';

-- Final message
DO $$
BEGIN
  RAISE NOTICE 'Database setup completed successfully!';
  RAISE NOTICE 'Tables created: disasters, reports, resources, cache, social_media_reports, official_updates';
  RAISE NOTICE 'Indexes created for optimal performance';
  RAISE NOTICE 'Sample data inserted for testing';
  RAISE NOTICE 'Geospatial functions created for location-based queries';
END $$;
