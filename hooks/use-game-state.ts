"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Room, Player, Hand, PlayerHand } from "@/lib/supabase/types";

export interface GameState {
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

  const isMounted = useRef(true);

  const fetchGameState = useCallback(async () => {
    if (!sessionId) return;

    const supabase = createClient({ "x-room-code": roomCode });

    // Fetch room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", roomCode)
      .single();

    if (!isMounted.current) return;

    if (roomError || !room) {
      setState((prev) => ({ ...prev, isLoading: false, error: "Room not found" }));
      return;
    }

    const playersPromise = supabase
      .from("players")
      .select("*")
      .eq("room_id", room.id)
      .order("seat");

    const handPromise =
      room.status === "playing"
        ? supabase
            .from("hands")
            .select("*")
            .eq("room_id", room.id)
            .order("version", { ascending: false })
            .limit(1)
            .single()
        : Promise.resolve({ data: null as Hand | null });

    const [{ data: players }, { data: handData }] = await Promise.all([
      playersPromise,
      handPromise,
    ]);

    if (!isMounted.current) return;

    // Find my player
    const myPlayer = players?.find((p) => p.session_id === sessionId);

    const hand: Hand | null = handData ?? null;
    let playerHands: PlayerHand[] = [];
    let myPlayerHand: PlayerHand | null = null;

    if (hand) {
      const { data: playerHandsData } = await supabase
        .from("player_hands")
        .select("*")
        .eq("hand_id", hand.id);

      if (!isMounted.current) return;

      playerHands = playerHandsData || [];
      myPlayerHand = playerHands.find((ph) => ph.player_id === myPlayer?.id) || null;
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

  const mutate = useCallback(
    (updater: (prev: GameState) => GameState) => {
      setState((prev) => updater(prev));
    },
    []
  );

  useEffect(() => {
    isMounted.current = true;

    if (!sessionId) return;

    const supabase = createClient({ "x-room-code": roomCode });

    const initialFetchId = setTimeout(() => {
      void fetchGameState();
    }, 0);

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
        () => {
          fetchGameState();
        }
      )
      .subscribe();

    return () => {
      isMounted.current = false;
      clearTimeout(initialFetchId);
      supabase.removeChannel(roomChannel);
    };
  }, [roomCode, sessionId, fetchGameState]);

  useEffect(() => {
    if (!sessionId || !state.room?.id) return;

    const supabase = createClient({ "x-room-code": roomCode });
    const roomId = state.room.id;

    const roomDataChannel = supabase
      .channel(`room-data:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchGameState();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hands",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchGameState();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomDataChannel);
    };
  }, [sessionId, state.room?.id, fetchGameState, roomCode]);

  useEffect(() => {
    if (!sessionId || !state.hand?.id) return;

    const supabase = createClient({ "x-room-code": roomCode });
    const handId = state.hand.id;

    const handChannel = supabase
      .channel(`hand:${handId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_hands",
          filter: `hand_id=eq.${handId}`,
        },
        () => {
          fetchGameState();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(handChannel);
    };
  }, [sessionId, state.hand?.id, fetchGameState, roomCode]);

  return {
    ...state,
    refetch: fetchGameState,
    mutate,
  };
}
