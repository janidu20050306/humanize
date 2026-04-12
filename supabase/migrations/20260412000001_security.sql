-- Enable RLS on the humanizations table
ALTER TABLE humanizations ENABLE ROW LEVEL SECURITY;

-- Note: No policies added here.
-- This means ONLY the service_role key (which bypasses RLS) can read/write.
-- The public 'anon' key will be blocked from accessing this table.
