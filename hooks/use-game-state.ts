"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { all } from "better-all";
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

type TableName = "rooms" | "players" | "hands" | "player_hands";

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
  const supabaseRef = useRef(createClient({ "x-room-code": roomCode }));

  // Initial full fetch
  const fetchGameState = useCallback(async () => {
    if (!sessionId) return;

    const supabase = supabaseRef.current;

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

    const { players, handData } = await all({
      players: async () => {
        const { data } = await supabase
          .from("players")
          .select("*")
          .eq("room_id", room.id)
          .order("seat");
        return data;
      },
      handData: async () => {
        if (room.status !== "playing") return null as Hand | null;
        const { data } = await supabase
          .from("hands")
          .select("*")
          .eq("room_id", room.id)
          .order("version", { ascending: false })
          .limit(1)
          .single();
        return data;
      },
    });

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

  // Selective fetch for specific tables
  const fetchTable = useCallback(
    async (table: TableName) => {
      if (!sessionId || !isMounted.current) return;

      const supabase = supabaseRef.current;

      switch (table) {
        case "rooms": {
          const { data: room } = await supabase
            .from("rooms")
            .select("*")
            .eq("code", roomCode)
            .single();

          if (!isMounted.current || !room) return;

          setState((prev) => {
            // If room status changed to playing, we need to fetch hand data
            if (prev.room?.status !== room.status && room.status === "playing") {
              // Trigger full refetch to get hand data
              setTimeout(() => fetchGameState(), 0);
              return prev;
            }
            return { ...prev, room };
          });
          break;
        }

        case "players": {
          const roomId = state.room?.id;
          if (!roomId) return;

          const { data: players } = await supabase
            .from("players")
            .select("*")
            .eq("room_id", roomId)
            .order("seat");

          if (!isMounted.current || !players) return;

          setState((prev) => ({
            ...prev,
            players,
          }));
          break;
        }

        case "hands": {
          const roomId = state.room?.id;
          if (!roomId) return;

          const { data: hand } = await supabase
            .from("hands")
            .select("*")
            .eq("room_id", roomId)
            .order("version", { ascending: false })
            .limit(1)
            .single();

          if (!isMounted.current) return;

          setState((prev) => {
            // If hand changed (new hand ID), fetch player_hands too
            if (hand && prev.hand?.id !== hand.id) {
              setTimeout(async () => {
                const { data: playerHands } = await supabase
                  .from("player_hands")
                  .select("*")
                  .eq("hand_id", hand.id);

                if (!isMounted.current) return;

                const myPlayer = prev.players.find((p) => p.session_id === sessionId);
                const myPlayerHand = playerHands?.find((ph) => ph.player_id === myPlayer?.id) || null;

                setState((p) => ({
                  ...p,
                  hand,
                  playerHands: playerHands || [],
                  myPlayerHand,
                }));
              }, 0);
              return prev;
            }
            return { ...prev, hand };
          });
          break;
        }

        case "player_hands": {
          const handId = state.hand?.id;
          if (!handId) return;

          const { data: playerHands } = await supabase
            .from("player_hands")
            .select("*")
            .eq("hand_id", handId);

          if (!isMounted.current || !playerHands) return;

          const myPlayer = state.players.find((p) => p.session_id === sessionId);
          const myPlayerHand = playerHands.find((ph) => ph.player_id === myPlayer?.id) || null;

          setState((prev) => ({
            ...prev,
            playerHands,
            myPlayerHand,
          }));
          break;
        }
      }
    },
    [roomCode, sessionId, state.room?.id, state.hand?.id, state.players, fetchGameState]
  );

  const mutate = useCallback(
    (updater: (prev: GameState) => GameState) => {
      setState((prev) => updater(prev));
    },
    []
  );

  // Initial fetch effect - separate from subscription to satisfy React Compiler
  useEffect(() => {
    if (!sessionId) return;
    // Schedule the fetch for the next tick to avoid synchronous setState
    const timeoutId = setTimeout(() => {
      fetchGameState();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [sessionId, fetchGameState]);

  // Single consolidated subscription effect
  useEffect(() => {
    isMounted.current = true;

    if (!sessionId) return;

    const supabase = supabaseRef.current;

    // Create unified channel for all table changes
    const channel = supabase.channel(`game:${roomCode}`);

    // Subscribe to rooms table changes
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "rooms",
        filter: `code=eq.${roomCode}`,
      },
      () => {
        fetchTable("rooms");
      }
    );

    // Subscribe to players table changes
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "players",
      },
      (payload) => {
        // Only process if it's for our room
        const record = (payload.new || payload.old) as { room_id?: string } | undefined;
        if (record?.room_id && record.room_id === state.room?.id) {
          fetchTable("players");
        } else if (!state.room?.id) {
          // Room not loaded yet, do full fetch
          fetchGameState();
        }
      }
    );

    // Subscribe to hands table changes
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "hands",
      },
      (payload) => {
        const record = (payload.new || payload.old) as { room_id?: string } | undefined;
        if (record?.room_id && record.room_id === state.room?.id) {
          fetchTable("hands");
        }
      }
    );

    // Subscribe to player_hands table changes
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "player_hands",
      },
      (payload) => {
        const record = (payload.new || payload.old) as { hand_id?: string } | undefined;
        if (record?.hand_id && record.hand_id === state.hand?.id) {
          fetchTable("player_hands");
        }
      }
    );

    channel.subscribe();

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [
    roomCode,
    sessionId,
    fetchGameState,
    fetchTable,
    state.room?.id,
    state.hand?.id,
  ]);

  // Re-subscribe when room or hand IDs change to get correct filters
  useEffect(() => {
    if (!sessionId || !state.room?.id) return;

    const supabase = supabaseRef.current;
    const roomId = state.room.id;
    const handId = state.hand?.id;

    // Create a more specific channel for room-scoped updates
    const scopedChannel = supabase.channel(`game-scoped:${roomId}`);

    scopedChannel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "players",
        filter: `room_id=eq.${roomId}`,
      },
      () => fetchTable("players")
    );

    scopedChannel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "hands",
        filter: `room_id=eq.${roomId}`,
      },
      () => fetchTable("hands")
    );

    if (handId) {
      scopedChannel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_hands",
          filter: `hand_id=eq.${handId}`,
        },
        () => fetchTable("player_hands")
      );
    }

    scopedChannel.subscribe();

    return () => {
      supabase.removeChannel(scopedChannel);
    };
  }, [sessionId, state.room?.id, state.hand?.id, fetchTable]);

  return {
    ...state,
    refetch: fetchGameState,
    mutate,
  };
}
