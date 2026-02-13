-- Allow 'quiz' as a valid type for study_materials
ALTER TABLE study_materials
DROP CONSTRAINT IF EXISTS study_materials_type_check;

ALTER TABLE study_materials
ADD CONSTRAINT study_materials_type_check CHECK (type IN ('note', 'flashcard', 'quiz'));
