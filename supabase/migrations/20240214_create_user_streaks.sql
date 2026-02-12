-- Create user_streaks table
CREATE TABLE IF NOT EXISTS user_streaks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  current_streak INTEGER DEFAULT 0 NOT NULL,
  longest_streak INTEGER DEFAULT 0 NOT NULL,
  last_login_date DATE,
  total_logins INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own streaks" 
ON user_streaks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own streaks" 
ON user_streaks 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own streaks" 
ON user_streaks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_user_streaks_user_id ON user_streaks(user_id);

-- Create function to update streak
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID)
RETURNS TABLE(current_streak INTEGER, longest_streak INTEGER, total_logins INTEGER) AS $$
DECLARE
  v_last_login_date DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_total_logins INTEGER;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Get existing streak data
  SELECT 
    COALESCE(last_login_date, v_today - INTERVAL '2 days')::DATE,
    COALESCE(user_streaks.current_streak, 0),
    COALESCE(user_streaks.longest_streak, 0),
    COALESCE(user_streaks.total_logins, 0)
  INTO v_last_login_date, v_current_streak, v_longest_streak, v_total_logins
  FROM user_streaks
  WHERE user_id = p_user_id;

  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_login_date, total_logins)
    VALUES (p_user_id, 1, 1, v_today, 1);
    
    RETURN QUERY SELECT 1, 1, 1;
    RETURN;
  END IF;

  -- If already logged in today, return current values
  IF v_last_login_date = v_today THEN
    RETURN QUERY SELECT v_current_streak, v_longest_streak, v_total_logins;
    RETURN;
  END IF;

  -- Check if login is consecutive (yesterday)
  IF v_last_login_date = v_today - INTERVAL '1 day' THEN
    v_current_streak := v_current_streak + 1;
  ELSE
    -- Streak broken, reset to 1
    v_current_streak := 1;
  END IF;

  -- Update longest streak if current is higher
  IF v_current_streak > v_longest_streak THEN
    v_longest_streak := v_current_streak;
  END IF;

  -- Increment total logins
  v_total_logins := v_total_logins + 1;

  -- Update the record
  UPDATE user_streaks
  SET 
    current_streak = v_current_streak,
    longest_streak = v_longest_streak,
    last_login_date = v_today,
    total_logins = v_total_logins,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT v_current_streak, v_longest_streak, v_total_logins;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
