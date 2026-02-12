-- Create tables and policies

-- Profiles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Workspaces
CREATE TABLE workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own workspaces" ON workspaces FOR ALL USING (auth.uid() = user_id);

-- Notes
CREATE TABLE notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT, -- Markdown or JSON
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notes" ON notes FOR ALL USING (auth.uid() = user_id);

-- Tasks
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tasks" ON tasks FOR ALL USING (auth.uid() = user_id);

-- PDF Uploads
CREATE TABLE pdf_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pdf_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own pdf uploads" ON pdf_uploads FOR ALL USING (auth.uid() = user_id);

-- Flashcards
CREATE TABLE flashcards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own flashcards" ON flashcards FOR ALL USING (auth.uid() = user_id);

-- Google Connections
CREATE TABLE google_connections (
  user_id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  provider TEXT DEFAULT 'google',
  access_token TEXT,
  refresh_token TEXT,
  expiry TIMESTAMPTZ,
  scopes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE google_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own google connection" ON google_connections FOR ALL USING (auth.uid() = user_id);

-- Linked Google Items
CREATE TABLE linked_google_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  item_type TEXT CHECK (item_type IN ('drive_file', 'calendar_event')),
  external_id TEXT NOT NULL,
  title TEXT,
  url TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE linked_google_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own linked items" ON linked_google_items FOR ALL USING (auth.uid() = user_id);

-- Storage Bucket Setup (Run this via Supabase UI or SQL Editor if extensions not enabled)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('pdfs', 'pdfs', false);

-- Storage Policies (Need explicit bucket creation first)
-- CREATE POLICY "User Uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pdfs' AND auth.uid() = owner);
-- CREATE POLICY "User Select" ON storage.objects FOR SELECT USING (bucket_id = 'pdfs' AND auth.uid() = owner);
-- CREATE POLICY "User Delete" ON storage.objects FOR DELETE USING (bucket_id = 'pdfs' AND auth.uid() = owner);

-- Handle User Creation Trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
