-- Add-on requests table
CREATE TABLE IF NOT EXISTS addon_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, player_id, status)
);

-- Enable RLS
ALTER TABLE addon_requests ENABLE ROW LEVEL SECURITY;

-- Allow all to read and insert
CREATE POLICY "Allow read access" ON addon_requests FOR SELECT USING (true);
CREATE POLICY "Allow insert access" ON addon_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update access" ON addon_requests FOR UPDATE USING (true);
CREATE POLICY "Allow delete access" ON addon_requests FOR DELETE USING (true);
