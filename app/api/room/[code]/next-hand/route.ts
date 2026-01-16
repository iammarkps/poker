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
        { error: "Only the host can start a new hand" },
        { status: 403 }
      );
    }

    // Get last hand to determine new dealer position
    const { data: lastHand } = await supabase
      .from("hands")
      .select("*")
      .eq("room_id", room.id)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    // Get players with chips
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", room.id)
      .gt("chips", 0)
      .order("seat");

    if (playersError || !players || players.length < 2) {
      return NextResponse.json(
        { error: "Need at least 2 players with chips" },
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

    // Move dealer to next player
    const lastDealerSeat = lastHand?.dealer_seat ?? -1;
    const dealerIndex = players.findIndex((p) => (p.seat ?? 0) > lastDealerSeat);
    const newDealerIndex = dealerIndex >= 0 ? dealerIndex : 0;
    const dealerSeat = players[newDealerIndex].seat ?? 0;

    // Determine blinds positions
    const smallBlindSeat =
      players.length === 2
        ? dealerSeat
        : players[(newDealerIndex + 1) % players.length].seat ?? 0;

    const bigBlindIndex =
      players.length === 2 ? (newDealerIndex + 1) % players.length : (newDealerIndex + 2) % players.length;
    const bigBlindSeat = players[bigBlindIndex].seat ?? 0;

    // First to act preflop is after big blind
    const firstToActIndex = (bigBlindIndex + 1) % players.length;
    const firstToAct = players[firstToActIndex].seat ?? 0;

    // Get new version number
    const newVersion = (lastHand?.version ?? 0) + 1;

    // Create new hand
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
        version: newVersion,
      })
      .select()
      .single();

    if (handError || !hand) {
      console.error("Hand creation error:", handError);
      return NextResponse.json(
        { error: "Failed to create hand" },
        { status: 500 }
      );
    }

    // Create player hands and post blinds
    const smallBlindPlayer = players.find((p) => p.seat === smallBlindSeat);
    const bigBlindPlayer = players.find((p) => p.seat === bigBlindSeat);

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
    if (smallBlindPlayer) {
      await supabase
        .from("players")
        .update({ chips: smallBlindPlayer.chips - room.small_blind })
        .eq("id", smallBlindPlayer.id);
    }

    if (bigBlindPlayer) {
      await supabase
        .from("players")
        .update({ chips: bigBlindPlayer.chips - room.big_blind })
        .eq("id", bigBlindPlayer.id);
    }

    return NextResponse.json({ success: true, handId: hand.id });
  } catch (error) {
    console.error("Next hand error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
