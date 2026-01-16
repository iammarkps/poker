-- Texas Hold'em Poker Database Schema
-- Run this in your Supabase SQL Editor

-- Game rooms
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code CHAR(6) UNIQUE NOT NULL,
  host_session_id TEXT NOT NULL,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  small_blind INTEGER DEFAULT 10,
  big_blind INTEGER DEFAULT 20,
  starting_chips INTEGER DEFAULT 1000,
  max_players INTEGER DEFAULT 9,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players in rooms
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  seat INTEGER,
  chips INTEGER NOT NULL,
  is_connected BOOLEAN DEFAULT true,
  UNIQUE(room_id, session_id),
  UNIQUE(room_id, seat)
);

-- Active hand state
CREATE TABLE IF NOT EXISTS hands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  dealer_seat INTEGER NOT NULL,
  community_cards TEXT[] DEFAULT '{}',
  pot INTEGER DEFAULT 0,
  current_bet INTEGER DEFAULT 0,
  current_seat INTEGER,
  phase TEXT DEFAULT 'preflop' CHECK (phase IN ('preflop', 'flop', 'turn', 'river', 'showdown')),
  deck TEXT[] NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player state per hand
CREATE TABLE IF NOT EXISTS player_hands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id UUID REFERENCES hands(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  hole_cards TEXT[] DEFAULT '{}',
  current_bet INTEGER DEFAULT 0,
  total_contributed INTEGER DEFAULT 0,
  has_acted BOOLEAN DEFAULT false,
  is_folded BOOLEAN DEFAULT false,
  is_all_in BOOLEAN DEFAULT false,
  UNIQUE(hand_id, player_id)
);

-- Action log
CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id UUID REFERENCES hands(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id),
  action TEXT NOT NULL CHECK (action IN ('fold', 'check', 'call', 'raise', 'all_in')),
  amount INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_players_room_id ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_players_session_id ON players(session_id);
CREATE INDEX IF NOT EXISTS idx_hands_room_id ON hands(room_id);
CREATE INDEX IF NOT EXISTS idx_player_hands_hand_id ON player_hands(hand_id);
CREATE INDEX IF NOT EXISTS idx_player_hands_player_id ON player_hands(player_id);
CREATE INDEX IF NOT EXISTS idx_actions_hand_id ON actions(hand_id);

-- Enable Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE hands ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_hands ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;

-- Scoped RLS Policies: service_role full access; anon read-only per room via header x-room-code
CREATE POLICY IF NOT EXISTS "rooms_service_rw" ON rooms
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "rooms_anon_select" ON rooms
  FOR SELECT TO anon
  USING (code = current_setting('request.headers', true)::json->>'x-room-code');

CREATE POLICY IF NOT EXISTS "players_service_rw" ON players
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "players_anon_select" ON players
  FOR SELECT TO anon
  USING (room_id IN (SELECT id FROM rooms WHERE code = current_setting('request.headers', true)::json->>'x-room-code'));

CREATE POLICY IF NOT EXISTS "hands_service_rw" ON hands
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "hands_anon_select" ON hands
  FOR SELECT TO anon
  USING (room_id IN (SELECT id FROM rooms WHERE code = current_setting('request.headers', true)::json->>'x-room-code'));

CREATE POLICY IF NOT EXISTS "player_hands_service_rw" ON player_hands
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "player_hands_anon_select" ON player_hands
  FOR SELECT TO anon
  USING (hand_id IN (
    SELECT id FROM hands WHERE room_id IN (
      SELECT id FROM rooms WHERE code = current_setting('request.headers', true)::json->>'x-room-code'
    )
  ));

CREATE POLICY IF NOT EXISTS "actions_service_rw" ON actions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "actions_anon_select" ON actions
  FOR SELECT TO anon
  USING (hand_id IN (
    SELECT id FROM hands WHERE room_id IN (
      SELECT id FROM rooms WHERE code = current_setting('request.headers', true)::json->>'x-room-code'
    )
  ));

-- Enable Realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE hands;
ALTER PUBLICATION supabase_realtime ADD TABLE player_hands;
ALTER PUBLICATION supabase_realtime ADD TABLE actions;
