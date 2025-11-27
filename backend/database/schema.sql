-- NewsWatch Database Schema

-- Stories table
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  headline TEXT NOT NULL,
  source TEXT,
  author TEXT,
  url TEXT UNIQUE,
  content TEXT,
  summary TEXT,
  published_at TIMESTAMP,
  ingested_at TIMESTAMP DEFAULT NOW(),
  pe_impact_score DECIMAL(3,2),
  pe_analysis JSONB,
  relevance_score DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  rating VARCHAR(10) CHECK (rating IN ('up', 'down')),
  feedback_text TEXT,
  submitted_at TIMESTAMP DEFAULT NOW(),
  ip_address VARCHAR(45)
);

-- Newsletters table
CREATE TABLE IF NOT EXISTS newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  subject TEXT,
  sent_at TIMESTAMP,
  recipient_count INTEGER,
  open_rate DECIMAL(5,2),
  story_ids UUID[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subscribers table
CREATE TABLE IF NOT EXISTS subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  subscribed_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  unsubscribed_at TIMESTAMP
);

-- Invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT false,
  used_by_email VARCHAR(255),
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stories_ingested_at ON stories(ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_pe_impact ON stories(pe_impact_score DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_story_id ON feedback(story_id);
CREATE INDEX IF NOT EXISTS idx_feedback_submitted_at ON feedback(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletters_date ON newsletters(date DESC);
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_invitations_code ON invitations(code);
