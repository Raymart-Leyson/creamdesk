-- Create Documents table for DocsApp
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT auth.uid() NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Document',
  content TEXT, -- HTML or Markdown content
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own documents" 
ON documents 
FOR ALL 
USING (auth.uid() = user_id);
