-- Create Study Materials table to store Notes and Flashcards
CREATE TABLE study_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT auth.uid() NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('note', 'flashcard')),
  content JSONB NOT NULL, -- Flexible storage: { text: "..." } for notes, { front: "...", back: "..." } for cards
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE study_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own study materials" 
ON study_materials 
FOR ALL 
USING (auth.uid() = user_id);

-- Optional: Indexes for faster querying
CREATE INDEX idx_study_materials_user_doc ON study_materials(user_id, document_id);
