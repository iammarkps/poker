"use client";

import { createContext, useContext, useMemo } from "react";
import { useSession } from "@/hooks/use-session";
import { useGameState, type GameState } from "@/hooks/use-game-state";
import { usePresence } from "@/hooks/use-presence";
import { evaluateHand } from "@/lib/poker/hand-evaluator";
import type { Room, Player, Hand, PlayerHand } from "@/lib/supabase/types";

interface WinnerData {
  playerId: string;
  handRank?: number;
  handName?: string;
}

interface WinnerInfo {
  type: "fold" | "showdown";
  winners: WinnerData[];
  winnerPlayerIds: Set<string>;
}

// Split contexts for fine-grained updates
interface RoomContextValue {
  room: Room | null;
  isHost: boolean;
  isLoading: boolean;
  error: string | null;
}

interface PlayersContextValue {
  players: Player[];
  myPlayer: Player | null;
  sessionId: string | null;
}

interface HandContextValue {
  hand: Hand | null;
  playerHands: PlayerHand[];
  myPlayerHand: PlayerHand | null;
  isMyTurn: boolean;
  winnerInfo: WinnerInfo | null;
  winnerPlayerIds: Set<string>;
}

interface GameActionsContextValue {
  refetch: () => Promise<void>;
  mutate: (updater: (prev: GameState) => GameState) => void;
}

// Create separate contexts
const RoomContext = createContext<RoomContextValue | null>(null);
const PlayersContext = createContext<PlayersContextValue | null>(null);
const HandContext = createContext<HandContextValue | null>(null);
const GameActionsContext = createContext<GameActionsContextValue | null>(null);

// Legacy combined context for backwards compatibility
interface GameContextValue extends RoomContextValue, PlayersContextValue, HandContextValue, GameActionsContextValue {}
const GameContext = createContext<GameContextValue | null>(null);

// Hooks for consuming contexts
export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error("useRoom must be used within a GameProvider");
  }
  return context;
}

export function usePlayers() {
  const context = useContext(PlayersContext);
  if (!context) {
    throw new Error("usePlayers must be used within a GameProvider");
  }
  return context;
}

export function useHand() {
  const context = useContext(HandContext);
  if (!context) {
    throw new Error("useHand must be used within a GameProvider");
  }
  return context;
}

export function useGameActions() {
  const context = useContext(GameActionsContext);
  if (!context) {
    throw new Error("useGameActions must be used within a GameProvider");
  }
  return context;
}

// Legacy hook - combines all contexts for backwards compatibility
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

  const myPlayer = useMemo(
    () => gameState.players.find((p) => p.session_id === sessionId) || null,
    [gameState.players, sessionId]
  );

  usePresence(roomCode, sessionId, myPlayer?.id || null);

  // Memoize winner calculation
  const winnerData = useMemo(() => {
    const { hand, players, playerHands } = gameState;
    const emptySet = new Set<string>();

    if (!hand || hand.phase !== "showdown") {
      return { winnerInfo: null, winnerPlayerIds: emptySet };
    }

    const playerToHand = new Map(playerHands.map((ph) => [ph.player_id, ph]));
    const activePlayers = players.filter((p) => {
      const ph = playerToHand.get(p.id);
      return ph && !ph.is_folded;
    });

    if (activePlayers.length === 1) {
      const winnerIds = new Set([activePlayers[0].id]);
      return {
        winnerInfo: {
          type: "fold" as const,
          winners: [{ playerId: activePlayers[0].id, handName: "Everyone else folded" }],
          winnerPlayerIds: winnerIds,
        },
        winnerPlayerIds: winnerIds,
      };
    }

    const evaluated = activePlayers.map((player) => {
      const ph = playerToHand.get(player.id);
      const evalHand = ph ? evaluateHand(ph.hole_cards, hand.community_cards) : null;
      return { player, hand: evalHand };
    });

    const sorted = evaluated
      .filter((e) => e.hand)
      .sort((a, b) => {
        if (!a.hand || !b.hand) return 0;
        if (a.hand.rank !== b.hand.rank) return b.hand.rank - a.hand.rank;
        for (let i = 0; i < Math.min(a.hand.values.length, b.hand.values.length); i++) {
          if (a.hand.values[i] !== b.hand.values[i]) {
            return b.hand.values[i] - a.hand.values[i];
          }
        }
        return 0;
      });

    if (sorted.length === 0) {
      return { winnerInfo: null, winnerPlayerIds: emptySet };
    }

    const winnerPlayerIds = new Set<string>();
    const winners: WinnerData[] = [];

    sorted.forEach((e) => {
      if (!e.hand || !sorted[0].hand) return;

      if (e.hand.rank === sorted[0].hand.rank) {
        let isWinner = true;
        for (let i = 0; i < Math.min(e.hand.values.length, sorted[0].hand.values.length); i++) {
          if (e.hand.values[i] !== sorted[0].hand.values[i]) {
            isWinner = false;
            break;
          }
        }
        if (isWinner) {
          winnerPlayerIds.add(e.player.id);
          winners.push({ playerId: e.player.id, handRank: e.hand.rank });
        }
      }
    });

    return {
      winnerInfo: {
        type: "showdown" as const,
        winners,
        winnerPlayerIds,
      },
      winnerPlayerIds,
    };
  }, [gameState]);

  // Memoize each context value separately
  const roomValue = useMemo<RoomContextValue>(
    () => ({
      room: gameState.room,
      isHost: gameState.room?.host_session_id === sessionId,
      isLoading: gameState.isLoading,
      error: gameState.error,
    }),
    [gameState.room, gameState.isLoading, gameState.error, sessionId]
  );

  const playersValue = useMemo<PlayersContextValue>(
    () => ({
      players: gameState.players,
      myPlayer,
      sessionId,
    }),
    [gameState.players, myPlayer, sessionId]
  );

  const handValue = useMemo<HandContextValue>(() => {
    let isMyTurn = false;
    if (gameState.hand && myPlayer) {
      isMyTurn = gameState.hand.current_seat === myPlayer.seat;
    }

    return {
      hand: gameState.hand,
      playerHands: gameState.playerHands,
      myPlayerHand: gameState.myPlayerHand,
      isMyTurn,
      winnerInfo: winnerData.winnerInfo,
      winnerPlayerIds: winnerData.winnerPlayerIds,
    };
  }, [gameState.hand, gameState.playerHands, gameState.myPlayerHand, myPlayer, winnerData]);

  const actionsValue = useMemo<GameActionsContextValue>(
    () => ({
      refetch: gameState.refetch,
      mutate: gameState.mutate,
    }),
    [gameState.refetch, gameState.mutate]
  );

  // Combined value for legacy useGame hook
  const combinedValue = useMemo<GameContextValue>(
    () => ({
      ...roomValue,
      ...playersValue,
      ...handValue,
      ...actionsValue,
    }),
    [roomValue, playersValue, handValue, actionsValue]
  );

  return (
    <GameContext.Provider value={combinedValue}>
      <RoomContext.Provider value={roomValue}>
        <PlayersContext.Provider value={playersValue}>
          <HandContext.Provider value={handValue}>
            <GameActionsContext.Provider value={actionsValue}>
              {children}
            </GameActionsContext.Provider>
          </HandContext.Provider>
        </PlayersContext.Provider>
      </RoomContext.Provider>
    </GameContext.Provider>
  );
}
