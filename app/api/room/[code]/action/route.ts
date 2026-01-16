import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dealCards } from "@/lib/poker/deck";
import {
  getValidActions,
  isActionValid,
  isBettingRoundComplete,
  countActivePlayers,
} from "@/lib/poker/game-rules";
import { determineWinners } from "@/lib/poker/winner";
import type { ActionType } from "@/lib/poker/game-rules";
import type { Room, Player, Hand, PlayerHand } from "@/lib/supabase/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { sessionId, action, amount } = body as {
      sessionId: string;
      action: ActionType;
      amount?: number;
    };

    if (!sessionId || !action) {
      return NextResponse.json(
        { error: "Session ID and action are required" },
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

    if (room.status !== "playing") {
      return NextResponse.json({ error: "Game not in progress" }, { status: 400 });
    }

    // Get current hand
    const { data: handData, error: handError } = await supabase
      .from("hands")
      .select("*")
      .eq("room_id", room.id)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (handError || !handData) {
      return NextResponse.json({ error: "No active hand" }, { status: 400 });
    }

    const hand = handData as Hand;

    // Get players
    const { data: playersData, error: playersError } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", room.id)
      .order("seat");

    if (playersError || !playersData) {
      return NextResponse.json({ error: "Failed to get players" }, { status: 500 });
    }

    const players = playersData as Player[];

    // Find current player
    const currentPlayer = players.find((p) => p.session_id === sessionId);
    if (!currentPlayer) {
      return NextResponse.json({ error: "Player not in room" }, { status: 403 });
    }

    // Verify it's player's turn
    if (hand.current_seat !== currentPlayer.seat) {
      return NextResponse.json({ error: "Not your turn" }, { status: 400 });
    }

    // Get player hands
    const { data: playerHandsData, error: phError } = await supabase
      .from("player_hands")
      .select("*")
      .eq("hand_id", hand.id);

    if (phError || !playerHandsData) {
      return NextResponse.json({ error: "Failed to get player hands" }, { status: 500 });
    }

    const playerHands = playerHandsData as PlayerHand[];

    const myPlayerHand = playerHands.find((ph) => ph.player_id === currentPlayer.id);
    if (!myPlayerHand) {
      return NextResponse.json({ error: "Player hand not found" }, { status: 500 });
    }

    // Validate action
    const validActions = getValidActions(hand, myPlayerHand, currentPlayer, room.big_blind);
    if (!isActionValid(action, amount, validActions)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Process action
    let newPot = hand.pot;
    let newCurrentBet = hand.current_bet;
    let newLastRaise = hand.last_raise;
    let playerChips = currentPlayer.chips;
    let playerBet = myPlayerHand.current_bet;
    let playerContribution = myPlayerHand.total_contributed ?? myPlayerHand.current_bet;
    let isFolded = false;
    let isAllIn = false;

    switch (action) {
      case "fold":
        isFolded = true;
        break;

      case "check":
        // No chip movement
        break;

      case "call": {
        const toCall = Math.min(hand.current_bet - myPlayerHand.current_bet, playerChips);
        playerChips -= toCall;
        playerBet += toCall;
        playerContribution += toCall;
        newPot += toCall;
        if (playerChips === 0) isAllIn = true;
        break;
      }

      case "raise": {
        if (amount === undefined) {
          return NextResponse.json({ error: "Raise amount required" }, { status: 400 });
        }
        const raiseAmount = amount - myPlayerHand.current_bet;
        const raiseIncrement = amount - hand.current_bet;
        playerChips -= raiseAmount;
        playerBet = amount;
        playerContribution += raiseAmount;
        newPot += raiseAmount;
        newLastRaise = raiseIncrement;
        newCurrentBet = amount;
        if (playerChips === 0) isAllIn = true;
        break;
      }

      case "all_in": {
        const allInAmount = playerChips;
        newPot += allInAmount;
        playerBet += allInAmount;
        playerContribution += allInAmount;
        if (playerBet > newCurrentBet) {
          const raiseIncrement = playerBet - newCurrentBet;
          if (raiseIncrement > 0) {
            newLastRaise = raiseIncrement;
          }
          newCurrentBet = playerBet;
        }
        playerChips = 0;
        isAllIn = true;
        break;
      }
    }

    // Update player hand
    await supabase
      .from("player_hands")
      .update({
        current_bet: playerBet,
        total_contributed: playerContribution,
        has_acted: true,
        is_folded: isFolded,
        is_all_in: isAllIn,
      })
      .eq("id", myPlayerHand.id);

    // Update player chips
    await supabase
      .from("players")
      .update({ chips: playerChips })
      .eq("id", currentPlayer.id);

    // Log action
    await supabase.from("actions").insert({
      hand_id: hand.id,
      player_id: currentPlayer.id,
      action,
      amount: action === "fold" || action === "check" ? null : playerBet,
    });

    // Get updated player hands for checking round completion
    const { data: updatedPlayerHands } = await supabase
      .from("player_hands")
      .select("*")
      .eq("hand_id", hand.id);

    const playerHandsMap = new Map(updatedPlayerHands?.map((ph) => [ph.player_id, ph]) || []);

    // Check if only one player remains
    const activeCount = countActivePlayers(players, playerHandsMap);

    if (activeCount === 1) {
      // Hand is over - award pot to winner
      const winners = determineWinners(players, updatedPlayerHands || [], hand.community_cards);

      const winnerUpdates = [];
      for (const winner of winners) {
        const winningPlayer = players.find((p) => p.id === winner.playerId);
        if (!winningPlayer) continue;
        winnerUpdates.push(
          supabase
            .from("players")
            .update({ chips: winningPlayer.chips + winner.amount })
            .eq("id", winner.playerId)
        );
      }

      await Promise.all(winnerUpdates);

      // Update hand to showdown
      await supabase
        .from("hands")
        .update({
          pot: 0,
          phase: "showdown",
          current_seat: null,
        })
        .eq("id", hand.id);

      return NextResponse.json({ success: true, handComplete: true });
    }

    // Check if betting round is complete
    const roundComplete = isBettingRoundComplete(players, playerHandsMap, newCurrentBet);

    if (roundComplete) {
      // If raise happened, need to reset has_acted for other players
      if (action === "raise" || action === "all_in") {
        const resetActions = [];
        for (const ph of updatedPlayerHands || []) {
          if (ph.player_id === currentPlayer.id || ph.is_folded || ph.is_all_in) {
            continue;
          }
          resetActions.push(
            supabase.from("player_hands").update({ has_acted: false }).eq("id", ph.id)
          );
        }

        await Promise.all(resetActions);

        // Find next player
        const nextSeat = findNextPlayer(
          currentPlayer.seat ?? 0,
          players,
          playerHandsMap
        );

        await supabase
          .from("hands")
          .update({
            pot: newPot,
            current_bet: newCurrentBet,
            current_seat: nextSeat,
            last_raise: newLastRaise,
            turn_start_time: new Date().toISOString(),
          })
          .eq("id", hand.id);

        return NextResponse.json({ success: true });
      }

      // Advance to next phase
      const nextPhase = getNextPhase(hand.phase);

      if (nextPhase === "showdown") {
        // Deal remaining community cards if needed
        let communityCards = [...hand.community_cards];
        let deck = [...hand.deck];

        while (communityCards.length < 5) {
          const { cards, remaining } = dealCards(deck, 1);
          communityCards = [...communityCards, ...cards];
          deck = remaining;
        }

        // Determine winners
        const { data: finalPlayerHands } = await supabase
          .from("player_hands")
          .select("*")
          .eq("hand_id", hand.id);

        const winners = determineWinners(players, finalPlayerHands || [], communityCards);

        const winnerUpdates = [];
        for (const winner of winners) {
          const winningPlayer = players.find((p) => p.id === winner.playerId);
          if (!winningPlayer) continue;
          winnerUpdates.push(
            supabase
              .from("players")
              .update({ chips: winningPlayer.chips + winner.amount })
              .eq("id", winner.playerId)
          );
        }

        await Promise.all(winnerUpdates);

        await supabase
          .from("hands")
          .update({
            pot: 0,
            community_cards: communityCards,
            deck,
            phase: "showdown",
            current_seat: null,
          })
          .eq("id", hand.id);

        return NextResponse.json({ success: true, handComplete: true, winners });
      }

      // Deal community cards
      let communityCards = [...hand.community_cards];
      let deck = [...hand.deck];

      const cardsToDeal = nextPhase === "flop" ? 3 : 1;
      const { cards, remaining } = dealCards(deck, cardsToDeal);
      communityCards = [...communityCards, ...cards];
      deck = remaining;

      // Reset betting for new round
      const resetBets = [];
      for (const ph of updatedPlayerHands || []) {
        if (ph.is_folded) continue;
        resetBets.push(
          supabase
            .from("player_hands")
            .update({ has_acted: false, current_bet: 0 })
            .eq("id", ph.id)
        );
      }

      await Promise.all(resetBets);

      // Find first player after dealer who is still active
      const firstToAct = findNextPlayer(hand.dealer_seat, players, playerHandsMap);

      await supabase
        .from("hands")
        .update({
          pot: newPot,
          current_bet: 0,
          community_cards: communityCards,
          deck,
          phase: nextPhase,
          current_seat: firstToAct,
          last_raise: room.big_blind,
          turn_start_time: new Date().toISOString(),
        })
        .eq("id", hand.id);

      return NextResponse.json({ success: true, newPhase: nextPhase });
    }

    // Find next player
    const nextSeat = findNextPlayer(currentPlayer.seat ?? 0, players, playerHandsMap);

    await supabase
      .from("hands")
      .update({
        pot: newPot,
        current_bet: newCurrentBet,
        current_seat: nextSeat,
        last_raise: newLastRaise,
        turn_start_time: new Date().toISOString(),
      })
      .eq("id", hand.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Action error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function getNextPhase(
  current: string
): "preflop" | "flop" | "turn" | "river" | "showdown" {
  switch (current) {
    case "preflop":
      return "flop";
    case "flop":
      return "turn";
    case "turn":
      return "river";
    case "river":
    default:
      return "showdown";
  }
}

function findNextPlayer(
  currentSeat: number,
  players: { id: string; seat: number | null }[],
  playerHands: Map<string, { is_folded: boolean; is_all_in: boolean }>
): number | null {
  const activePlayers = players.filter((p) => {
    const ph = playerHands.get(p.id);
    return ph && !ph.is_folded && !ph.is_all_in;
  });

  if (activePlayers.length === 0) return null;

  const seats = activePlayers.map((p) => p.seat ?? 0).sort((a, b) => a - b);

  for (const seat of seats) {
    if (seat > currentSeat) return seat;
  }

  return seats[0]; // Wrap around
}
