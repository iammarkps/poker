import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, name, startingChips, smallBlind, bigBlind } = body;

    if (!sessionId || !name) {
      return NextResponse.json(
        { error: "Session ID and name are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Generate unique room code
    let code = generateRoomCode();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from("rooms")
        .select("id")
        .eq("code", code)
        .single();

      if (!existing) break;
      code = generateRoomCode();
      attempts++;
    }

    // Create room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({
        code,
        host_session_id: sessionId,
        starting_chips: startingChips || 1000,
        small_blind: smallBlind || 10,
        big_blind: bigBlind || 20,
      })
      .select()
      .single();

    if (roomError) {
      console.error("Room creation error:", roomError);
      return NextResponse.json(
        { error: "Failed to create room" },
        { status: 500 }
      );
    }

    // Add host as first player
    const { error: playerError } = await supabase.from("players").insert({
      room_id: room.id,
      session_id: sessionId,
      name,
      chips: room.starting_chips,
      seat: 0,
    });

    if (playerError) {
      console.error("Player creation error:", playerError);
      // Clean up room if player creation fails
      await supabase.from("rooms").delete().eq("id", room.id);
      return NextResponse.json(
        { error: "Failed to join room" },
        { status: 500 }
      );
    }

    return NextResponse.json({ code: room.code, roomId: room.id });
  } catch (error) {
    console.error("Create room error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
