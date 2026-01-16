"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Room, Player, Hand, PlayerHand } from "@/lib/supabase/types";

interface GameState {
  room: Room | null;
  players: Player[];
  hand: Hand | null;
  playerHands: PlayerHand[];
  myPlayerHand: PlayerHand | null;
  isLoading: boolean;
  error: string | null;
}

export function useGameState(roomCode: string, sessionId: string | null) {
  const [state, setState] = useState<GameState>({
    room: null,
    players: [],
    hand: null,
    playerHands: [],
    myPlayerHand: null,
    isLoading: true,
    error: null,
  });

  const fetchGameState = useCallback(async () => {
    if (!sessionId) return;

    const supabase = createClient();

    // Fetch room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", roomCode)
      .single();

    if (roomError || !room) {
      setState((prev) => ({ ...prev, isLoading: false, error: "Room not found" }));
      return;
    }

    // Fetch players
    const { data: players } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", room.id)
      .order("seat");

    // Find my player
    const myPlayer = players?.find((p) => p.session_id === sessionId);

    // Fetch current hand if game is playing
    let hand: Hand | null = null;
    let playerHands: PlayerHand[] = [];
    let myPlayerHand: PlayerHand | null = null;

    if (room.status === "playing") {
      const { data: handData } = await supabase
        .from("hands")
        .select("*")
        .eq("room_id", room.id)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      hand = handData;

      if (hand) {
        const { data: playerHandsData } = await supabase
          .from("player_hands")
          .select("*")
          .eq("hand_id", hand.id);

        playerHands = playerHandsData || [];
        myPlayerHand = playerHands.find((ph) => ph.player_id === myPlayer?.id) || null;
      }
    }

    setState({
      room,
      players: players || [],
      hand,
      playerHands,
      myPlayerHand,
      isLoading: false,
      error: null,
    });
  }, [roomCode, sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    fetchGameState();

    const supabase = createClient();

    // Subscribe to room changes
    const roomChannel = supabase
      .channel(`room:${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `code=eq.${roomCode}`,
        },
        () => fetchGameState()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
        },
        () => fetchGameState()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hands",
        },
        () => fetchGameState()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_hands",
        },
        () => fetchGameState()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [roomCode, sessionId, fetchGameState]);

  return {
    ...state,
    refetch: fetchGameState,
  };
}
