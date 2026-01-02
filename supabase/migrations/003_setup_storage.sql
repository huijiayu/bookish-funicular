-- Create storage bucket for clothing items
INSERT INTO storage.buckets (id, name, public)
VALUES ('clothing-items', 'clothing-items', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for storage
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

