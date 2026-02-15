-- Add 'expires_at' column to 'user_tokens' table
ALTER TABLE user_tokens
ADD COLUMN expires_at timestamptz;

-- Create a function to check and expire tokens
CREATE OR REPLACE FUNCTION expire_tokens()
RETURNS trigger AS $$
BEGIN
  -- If tokens are expired, set balance to 0 (or some fallback value like 20)
  IF NEW.expires_at < NOW() AND NEW.tokens > 20 THEN
    NEW.tokens := 20; -- Reset to daily free limit
    NEW.expires_at := NULL; -- Clear expiration until next purchase
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger this check on every update/select is tricky to do automatically efficiently.
-- A simpler manual approach for now:
-- When you add tokens, you will set the expiry manually in the SQL editor.

-- Example: Add 500 tokens that expire in 30 days
-- UPDATE user_tokens 
-- SET tokens = tokens + 500, expires_at = NOW() + INTERVAL '30 days' 
-- WHERE user_id = 'USER_ID_HERE';
