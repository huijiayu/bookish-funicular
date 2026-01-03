-- Combined Migration: Apply all migrations in order
-- This file combines all migrations for easy application via Supabase Dashboard or CLI

-- ============================================================================
-- Migration 004: Enable pgvector extension (must be first)
-- ============================================================================
-- Enable pgvector extension for vision embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- Migration 001: Create clothing_items table
-- ============================================================================
CREATE TABLE IF NOT EXISTS clothing_items (
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

-- Create indexes (with IF NOT EXISTS check)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_clothing_items_user_id') THEN
    CREATE INDEX idx_clothing_items_user_id ON clothing_items(user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_clothing_items_perceptual_hash') THEN
    CREATE INDEX idx_clothing_items_perceptual_hash ON clothing_items(perceptual_hash);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_clothing_items_ai_metadata') THEN
    CREATE INDEX idx_clothing_items_ai_metadata ON clothing_items USING GIN(ai_metadata);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_clothing_items_vision_embedding') THEN
    CREATE INDEX idx_clothing_items_vision_embedding ON clothing_items USING ivfflat (vision_embedding vector_cosine_ops);
  END IF;
END $$;

-- RLS Policies
ALTER TABLE clothing_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running)
DROP POLICY IF EXISTS "Users can view their own clothing items" ON clothing_items;
DROP POLICY IF EXISTS "Users can insert their own clothing items" ON clothing_items;
DROP POLICY IF EXISTS "Users can update their own clothing items" ON clothing_items;
DROP POLICY IF EXISTS "Users can delete their own clothing items" ON clothing_items;

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

-- ============================================================================
-- Migration 002: Create wear_events table
-- ============================================================================
CREATE TABLE IF NOT EXISTS wear_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clothing_item_id UUID NOT NULL REFERENCES clothing_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worn_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes (with IF NOT EXISTS check)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_wear_events_clothing_item_id') THEN
    CREATE INDEX idx_wear_events_clothing_item_id ON wear_events(clothing_item_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_wear_events_user_id') THEN
    CREATE INDEX idx_wear_events_user_id ON wear_events(user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_wear_events_worn_at') THEN
    CREATE INDEX idx_wear_events_worn_at ON wear_events(worn_at);
  END IF;
END $$;

-- RLS Policies
ALTER TABLE wear_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running)
DROP POLICY IF EXISTS "Users can view their own wear events" ON wear_events;
DROP POLICY IF EXISTS "Users can insert their own wear events" ON wear_events;
DROP POLICY IF EXISTS "Users can update their own wear events" ON wear_events;
DROP POLICY IF EXISTS "Users can delete their own wear events" ON wear_events;

CREATE POLICY "Users can view their own wear events"
  ON wear_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wear events"
  ON wear_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wear events"
  ON wear_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wear events"
  ON wear_events FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Migration 003: Setup storage bucket and policies
-- ============================================================================
-- Create storage bucket for clothing items
INSERT INTO storage.buckets (id, name, public)
VALUES ('clothing-items', 'clothing-items', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for storage
-- Drop existing policies if they exist (to allow re-running)
DROP POLICY IF EXISTS "Users can upload their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;

CREATE POLICY "Users can upload their own images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'clothing-items' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'clothing-items' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'clothing-items' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

