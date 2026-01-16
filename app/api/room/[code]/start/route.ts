import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDeck, shuffleDeck, dealCards } from "@/lib/poker/deck";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
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
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Verify host
    if (room.host_session_id !== sessionId) {
      return NextResponse.json(
        { error: "Only the host can start the game" },
        { status: 403 }
      );
    }

    if (room.status !== "waiting") {
      return NextResponse.json(
        { error: "Game already started" },
        { status: 400 }
      );
    }

    // Get players
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", room.id)
      .order("seat");

    if (playersError || !players || players.length < 2) {
      return NextResponse.json(
        { error: "Need at least 2 players" },
        { status: 400 }
      );
    }

    // Create and shuffle deck
    let deck = shuffleDeck(createDeck());

    // Deal hole cards to each player
    const playerHoleCards: Map<string, string[]> = new Map();
    for (const player of players) {
      const { cards, remaining } = dealCards(deck, 2);
      playerHoleCards.set(player.id, cards);
      deck = remaining;
    }

    // Determine dealer (first player for first hand)
    const dealerSeat = players[0].seat ?? 0;

    // Determine blinds positions
    const smallBlindSeat =
      players.length === 2
        ? dealerSeat // Heads-up: dealer is small blind
        : players[(players.findIndex((p) => p.seat === dealerSeat) + 1) % players.length].seat ?? 0;

    const bigBlindSeat =
      players[(players.findIndex((p) => p.seat === smallBlindSeat) + 1) % players.length].seat ?? 0;

    // First to act preflop is after big blind
    const firstToAct =
      players[(players.findIndex((p) => p.seat === bigBlindSeat) + 1) % players.length].seat ?? 0;

    // Update room status
    const { error: roomUpdateError } = await supabase
      .from("rooms")
      .update({ status: "playing" })
      .eq("id", room.id);

    if (roomUpdateError) {
      console.error("Room update error:", roomUpdateError);
      return NextResponse.json(
        { error: "Failed to start game" },
        { status: 500 }
      );
    }

    // Create hand
    const { data: hand, error: handError } = await supabase
      .from("hands")
      .insert({
        room_id: room.id,
        dealer_seat: dealerSeat,
        community_cards: [],
        pot: room.small_blind + room.big_blind,
        current_bet: room.big_blind,
        current_seat: firstToAct,
        phase: "preflop",
        deck,
        last_raise: room.big_blind,
        turn_start_time: new Date().toISOString(),
      })
      .select()
      .single();

    if (handError || !hand) {
      console.error("Hand creation error:", handError);
      // Rollback room status
      await supabase.from("rooms").update({ status: "waiting" }).eq("id", room.id);
      return NextResponse.json(
        { error: "Failed to create hand" },
        { status: 500 }
      );
    }

    // Create player hands and post blinds
    const playerHandsInserts = players.map((player) => {
      const isSB = player.seat === smallBlindSeat;
      const isBB = player.seat === bigBlindSeat;
      const blindAmount = isSB ? room.small_blind : isBB ? room.big_blind : 0;

      return {
        hand_id: hand.id,
        player_id: player.id,
        hole_cards: playerHoleCards.get(player.id) || [],
        current_bet: blindAmount,
        has_acted: false,
        is_folded: false,
        is_all_in: false,
      };
    });

    const { error: playerHandsError } = await supabase
      .from("player_hands")
      .insert(playerHandsInserts);

    if (playerHandsError) {
      console.error("Player hands error:", playerHandsError);
      return NextResponse.json(
        { error: "Failed to deal cards" },
        { status: 500 }
      );
    }

    // Deduct blinds from players
    const smallBlindPlayer = players.find((p) => p.seat === smallBlindSeat);
    const bigBlindPlayer = players.find((p) => p.seat === bigBlindSeat);

    const blindUpdates = [];
    if (smallBlindPlayer) {
      blindUpdates.push(
        supabase
          .from("players")
          .update({ chips: smallBlindPlayer.chips - room.small_blind })
          .eq("id", smallBlindPlayer.id)
      );
    }

    if (bigBlindPlayer) {
      blindUpdates.push(
        supabase
          .from("players")
          .update({ chips: bigBlindPlayer.chips - room.big_blind })
          .eq("id", bigBlindPlayer.id)
      );
    }

    await Promise.all(blindUpdates);

    return NextResponse.json({ success: true, handId: hand.id });
  } catch (error) {
    console.error("Start game error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
