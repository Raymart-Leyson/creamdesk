-- Create tokens table for AI usage tracking
CREATE TABLE IF NOT EXISTS user_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT auth.uid() NOT NULL,
  tokens INTEGER DEFAULT 100 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tokens" 
ON user_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens" 
ON user_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens" 
ON user_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_user_tokens_user_id ON user_tokens(user_id);

-- Create function to initialize tokens for new users
CREATE OR REPLACE FUNCTION initialize_user_tokens()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_tokens (user_id, tokens)
  VALUES (NEW.id, 100)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: You'll need to create a trigger on auth.users if you want auto-initialization
-- For now, we'll handle it in the app code
