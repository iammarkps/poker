import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { all } from "better-all";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { sessionId, name } = body;

    if (!sessionId || !name) {
      return NextResponse.json(
        { error: "Session ID and name are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Find room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code.toUpperCase())
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: "Room not found" },
        { status: 404 }
      );
    }

    if (room.status !== "waiting") {
      return NextResponse.json(
        { error: "Game already in progress" },
        { status: 400 }
      );
    }

    // Parallelize: check existing player + get all players (both need room.id)
    const { existingPlayerResult, playersResult } = await all({
      async existingPlayerResult() {
        return supabase
          .from("players")
          .select("*")
          .eq("room_id", room.id)
          .eq("session_id", sessionId)
          .single();
      },
      async playersResult() {
        return supabase.from("players").select("seat").eq("room_id", room.id);
      },
    });

    const { data: existingPlayer } = existingPlayerResult;
    const { data: players } = playersResult;

    if (existingPlayer) {
      // Update name and reconnect
      await supabase
        .from("players")
        .update({ name, is_connected: true })
        .eq("id", existingPlayer.id);

      return NextResponse.json({ success: true, playerId: existingPlayer.id });
    }

    if (players && players.length >= room.max_players) {
      return NextResponse.json(
        { error: "Room is full" },
        { status: 400 }
      );
    }

    // Find first available seat
    const takenSeats = new Set(players?.map((p) => p.seat) || []);
    let seat = 0;
    while (takenSeats.has(seat) && seat < room.max_players) {
      seat++;
    }

    // Add player
    const { data: player, error: playerError } = await supabase
      .from("players")
      .insert({
        room_id: room.id,
        session_id: sessionId,
        name,
        chips: room.starting_chips,
        seat,
      })
      .select()
      .single();

    if (playerError) {
      console.error("Player join error:", playerError);
      return NextResponse.json(
        { error: "Failed to join room" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, playerId: player.id });
  } catch (error) {
    console.error("Join room error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
