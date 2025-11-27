-- Source Quality Tracking

CREATE TABLE IF NOT EXISTS source_quality (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT UNIQUE NOT NULL,
  name TEXT,
  quality_score DECIMAL(5,2) DEFAULT 5.00, -- 0.00 to 10.00
  total_stories INTEGER DEFAULT 0,
  positive_feedback_count INTEGER DEFAULT 0,
  negative_feedback_count INTEGER DEFAULT 0,
  last_evaluated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_source_quality_score ON source_quality(quality_score DESC);

-- Initial seed of known sources
INSERT INTO source_quality (domain, name, quality_score) VALUES
  ('techcrunch.com', 'TechCrunch', 7.0),
  ('bloomberg.com', 'Bloomberg', 8.0),
  ('wsj.com', 'Wall Street Journal', 8.5),
  ('theinformation.com', 'The Information', 9.0),
  ('news.ycombinator.com', 'Hacker News', 6.0)
ON CONFLICT (domain) DO NOTHING;
