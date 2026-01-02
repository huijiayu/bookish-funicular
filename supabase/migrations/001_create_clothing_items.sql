CREATE TABLE clothing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_urls JSONB NOT NULL DEFAULT '{"primary": "", "variants": []}'::jsonb,
  -- Structure: {"primary": "url1", "variants": ["url2", "url3", ...]}
  perceptual_hash TEXT, -- For exact duplicate detection (indexed)
  vision_embedding vector(1536), -- For semantic similarity (using pgvector extension)
  ai_metadata JSONB, -- {category, sub_category, primary_color, secondary_colors, vibe_tags, estimated_season}
  price DECIMAL(10,2),
  initial_wears INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clothing_items_user_id ON clothing_items(user_id);
CREATE INDEX idx_clothing_items_perceptual_hash ON clothing_items(perceptual_hash);
CREATE INDEX idx_clothing_items_ai_metadata ON clothing_items USING GIN(ai_metadata);
CREATE INDEX idx_clothing_items_vision_embedding ON clothing_items USING ivfflat (vision_embedding vector_cosine_ops);
-- Note: Requires pgvector extension: CREATE EXTENSION IF NOT EXISTS vector;

-- RLS Policies
ALTER TABLE clothing_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own clothing items"
  ON clothing_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clothing items"
  ON clothing_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clothing items"
  ON clothing_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clothing items"
  ON clothing_items FOR DELETE
  USING (auth.uid() = user_id);

