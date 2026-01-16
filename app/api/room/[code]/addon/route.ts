import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Room, Player } from "@/lib/supabase/types";

// POST - Request add-on
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { sessionId, amount } = body as {
      sessionId: string;
      amount: number;
    };

    if (!sessionId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "Session ID and positive amount are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Find room
    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code.toUpperCase())
      .single();

    if (roomError || !roomData) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const room = roomData as Room;

    // Find player
    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", room.id)
      .eq("session_id", sessionId)
      .single();

    if (playerError || !playerData) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const player = playerData as Player;

    // Check for existing pending request
    const { data: existingRequest } = await supabase
      .from("addon_requests")
      .select("*")
      .eq("room_id", room.id)
      .eq("player_id", player.id)
      .eq("status", "pending")
      .single();

    if (existingRequest) {
      return NextResponse.json(
        { error: "You already have a pending add-on request" },
        { status: 400 }
      );
    }

    // Create add-on request
    const { data: request_, error: requestError } = await supabase
      .from("addon_requests")
      .insert({
        room_id: room.id,
        player_id: player.id,
        amount,
        status: "pending",
      })
      .select()
      .single();

    if (requestError) {
      console.error("Add-on request error:", requestError);
      return NextResponse.json(
        { error: "Failed to create add-on request" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, request: request_ });
  } catch (error) {
    console.error("Add-on request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET - Get pending add-on requests (for host)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Find room
    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code.toUpperCase())
      .single();

    if (roomError || !roomData) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const room = roomData as Room;

    // Get pending requests
    const { data: requests, error: requestsError } = await supabase
      .from("addon_requests")
      .select("*")
      .eq("room_id", room.id)
      .eq("status", "pending");

    if (requestsError) {
      return NextResponse.json(
        { error: "Failed to get add-on requests" },
        { status: 500 }
      );
    }

    // Get player names for each request
    const playerIds = requests?.map((r) => r.player_id) || [];
    const { data: players } = await supabase
      .from("players")
      .select("id, name")
      .in("id", playerIds);

    const requestsWithNames = requests?.map((r) => ({
      ...r,
      playerName: players?.find((p) => p.id === r.player_id)?.name || "Unknown",
    }));

    return NextResponse.json({ requests: requestsWithNames });
  } catch (error) {
    console.error("Get add-on requests error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Approve or reject add-on request (host only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { sessionId, requestId, approve } = body as {
      sessionId: string;
      requestId: string;
      approve: boolean;
    };

    if (!sessionId || !requestId || approve === undefined) {
      return NextResponse.json(
        { error: "Session ID, request ID, and approve status are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Find room
    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code.toUpperCase())
      .single();

    if (roomError || !roomData) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const room = roomData as Room;

    // Verify host
    if (room.host_session_id !== sessionId) {
      return NextResponse.json(
        { error: "Only the host can approve/reject add-on requests" },
        { status: 403 }
      );
    }

    // Get the request
    const { data: addonRequest, error: requestError } = await supabase
      .from("addon_requests")
      .select("*")
      .eq("id", requestId)
      .eq("room_id", room.id)
      .eq("status", "pending")
      .single();

    if (requestError || !addonRequest) {
      return NextResponse.json(
        { error: "Add-on request not found" },
        { status: 404 }
      );
    }

    if (approve) {
      // Get player and add chips
      const { data: player } = await supabase
        .from("players")
        .select("*")
        .eq("id", addonRequest.player_id)
        .single();

      if (player) {
        await supabase
          .from("players")
          .update({ chips: player.chips + addonRequest.amount })
          .eq("id", player.id);
      }
    }

    // Update request status
    await supabase
      .from("addon_requests")
      .update({ status: approve ? "approved" : "rejected" })
      .eq("id", requestId);

    return NextResponse.json({
      success: true,
      status: approve ? "approved" : "rejected",
    });
  } catch (error) {
    console.error("Approve add-on request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
