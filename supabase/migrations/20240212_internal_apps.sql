-- Create tables for Internal Drive and Calendar

-- Internal Files (Drive)
CREATE TABLE files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT auth.uid() NOT NULL,
  name TEXT NOT NULL,
  size BIGINT,
  type TEXT,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own files" 
ON files FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files" 
ON files FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files" 
ON files FOR DELETE 
USING (auth.uid() = user_id);

-- Internal Events (Calendar)
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT auth.uid() NOT NULL,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  description TEXT,
  location TEXT,
  color TEXT DEFAULT 'blue',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own events" 
ON events FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own events" 
ON events FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events" 
ON events FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events" 
ON events FOR DELETE 
USING (auth.uid() = user_id);

-- Storage Bucket for Drive Files
-- Note: You need to create a bucket named 'drive' in Supabase Storage manually or via UI if this fails.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('drive', 'drive', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Give users access to own folder 1bk803_0" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'drive' AND auth.uid() = owner);
CREATE POLICY "Give users access to own folder 1bk803_1" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'drive' AND auth.uid() = owner);
CREATE POLICY "Give users access to own folder 1bk803_2" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'drive' AND auth.uid() = owner);
