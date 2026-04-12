-- HumanizeAI: initial schema
-- Stores every humanization request for history & analytics

CREATE TABLE IF NOT EXISTS humanizations (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  input_text   TEXT        NOT NULL,
  output_text  TEXT        NOT NULL,
  tone         VARCHAR(50) NOT NULL,
  intensity    INTEGER     NOT NULL CHECK (intensity BETWEEN 1 AND 100),
  word_count   INTEGER,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast history queries (newest first)
CREATE INDEX IF NOT EXISTS humanizations_created_at_idx
  ON humanizations (created_at DESC);

-- Optional: auto-delete rows older than 90 days to keep the DB lean
-- (Uncomment if you want auto-cleanup via pg_cron)
-- SELECT cron.schedule('cleanup-old', '0 3 * * *',
--   $$DELETE FROM humanizations WHERE created_at < NOW() - INTERVAL '90 days'$$);
