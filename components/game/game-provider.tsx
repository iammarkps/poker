"use client";

import { createContext, useContext, useMemo } from "react";
import { useSession } from "@/hooks/use-session";
import { useGameState } from "@/hooks/use-game-state";
import { usePresence } from "@/hooks/use-presence";
import type { Room, Player, Hand, PlayerHand } from "@/lib/supabase/types";

interface GameContextValue {
  room: Room | null;
  players: Player[];
  hand: Hand | null;
  playerHands: PlayerHand[];
  myPlayerHand: PlayerHand | null;
  myPlayer: Player | null;
  sessionId: string | null;
  isHost: boolean;
  isMyTurn: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}

interface GameProviderProps {
  roomCode: string;
  children: React.ReactNode;
}

export function GameProvider({ roomCode, children }: GameProviderProps) {
  const sessionId = useSession();
  const gameState = useGameState(roomCode, sessionId);

  const myPlayer = gameState.players.find((p) => p.session_id === sessionId) || null;
  usePresence(roomCode, sessionId, myPlayer?.id || null);

  const value = useMemo(() => {
    const myPlayer = gameState.players.find((p) => p.session_id === sessionId) || null;
    const isHost = gameState.room?.host_session_id === sessionId;

    // Determine if it's my turn
    let isMyTurn = false;
    if (gameState.hand && myPlayer) {
      isMyTurn = gameState.hand.current_seat === myPlayer.seat;
    }

    return {
      ...gameState,
      myPlayer,
      sessionId,
      isHost,
      isMyTurn,
    };
  }, [gameState, sessionId]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
