CREATE TABLE wear_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clothing_item_id UUID NOT NULL REFERENCES clothing_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worn_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wear_events_clothing_item_id ON wear_events(clothing_item_id);
CREATE INDEX idx_wear_events_user_id ON wear_events(user_id);
CREATE INDEX idx_wear_events_worn_at ON wear_events(worn_at);

-- RLS Policies
ALTER TABLE wear_events ENABLE ROW LEVEL SECURITY;

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

