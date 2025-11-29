-- Migration: Fix score field precision to prevent numeric overflow
-- Date: 2025-11-27
-- Description: Change pe_impact_score and relevance_score from DECIMAL(3,2) to DECIMAL(4,2)
--              to allow scores up to 99.99 instead of 9.99

-- This is needed because the multi-source story boosting feature can create scores > 10.0
-- Formula: base_score * (1 + (source_count - 1) * 0.15)
-- Example: A story with 5 sources and base score 8.0 would become 8.0 * 1.60 = 12.8

BEGIN;

-- Alter the pe_impact_score column
ALTER TABLE stories 
  ALTER COLUMN pe_impact_score TYPE DECIMAL(4,2);

-- Alter the relevance_score column
ALTER TABLE stories 
  ALTER COLUMN relevance_score TYPE DECIMAL(4,2);

COMMIT;

-- Verify the changes
\d stories
