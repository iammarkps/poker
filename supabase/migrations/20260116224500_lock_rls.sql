-- Replace open RLS policies with scoped ones

-- ROOMS
DROP POLICY IF EXISTS "Allow all operations on rooms" ON rooms;
CREATE POLICY "rooms_service_rw" ON rooms
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "rooms_anon_select" ON rooms
  FOR SELECT TO anon
  USING (code = current_setting('request.headers', true)::json->>'x-room-code');

-- PLAYERS
DROP POLICY IF EXISTS "Allow all operations on players" ON players;
CREATE POLICY "players_service_rw" ON players
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "players_anon_select" ON players
  FOR SELECT TO anon
  USING (room_id IN (
    SELECT id FROM rooms WHERE code = current_setting('request.headers', true)::json->>'x-room-code'
  ));

-- HANDS
DROP POLICY IF EXISTS "Allow all operations on hands" ON hands;
CREATE POLICY "hands_service_rw" ON hands
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "hands_anon_select" ON hands
  FOR SELECT TO anon
  USING (room_id IN (
    SELECT id FROM rooms WHERE code = current_setting('request.headers', true)::json->>'x-room-code'
  ));

-- PLAYER_HANDS
DROP POLICY IF EXISTS "Allow all operations on player_hands" ON player_hands;
CREATE POLICY "player_hands_service_rw" ON player_hands
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "player_hands_anon_select" ON player_hands
  FOR SELECT TO anon
  USING (hand_id IN (
    SELECT id FROM hands WHERE room_id IN (
      SELECT id FROM rooms WHERE code = current_setting('request.headers', true)::json->>'x-room-code'
    )
  ));

-- ACTIONS
DROP POLICY IF EXISTS "Allow all operations on actions" ON actions;
CREATE POLICY "actions_service_rw" ON actions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "actions_anon_select" ON actions
  FOR SELECT TO anon
  USING (hand_id IN (
    SELECT id FROM hands WHERE room_id IN (
      SELECT id FROM rooms WHERE code = current_setting('request.headers', true)::json->>'x-room-code'
    )
  ));

-- ADDON REQUESTS
DROP POLICY IF EXISTS "Allow all operations on addon_requests" ON addon_requests;
CREATE POLICY "addon_service_rw" ON addon_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "addon_anon_select" ON addon_requests
  FOR SELECT TO anon
  USING (room_id IN (
    SELECT id FROM rooms WHERE code = current_setting('request.headers', true)::json->>'x-room-code'
  ));
