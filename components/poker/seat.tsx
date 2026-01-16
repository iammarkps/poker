"use client";

import { cn } from "@/lib/utils";
import { PlayingCard } from "./playing-card";
import type { Player, PlayerHand } from "@/lib/supabase/types";

interface SeatProps {
  player?: Player;
  playerHand?: PlayerHand;
  holeCards?: string[];
  isCurrentTurn: boolean;
  isDealer: boolean;
  isMe: boolean;
  showCards: boolean;
}

export function Seat({
  player,
  playerHand,
  holeCards,
  isCurrentTurn,
  isDealer,
  isMe,
  showCards,
}: SeatProps) {
  if (!player) {
    return (
      <div className="w-24 h-28 rounded-xl border-2 border-dashed border-green-700/50 flex items-center justify-center">
        <span className="text-green-700/50 text-xs">Empty</span>
      </div>
    );
  }

  const isFolded = playerHand?.is_folded;
  const isAllIn = playerHand?.is_all_in;
  const bet = playerHand?.current_bet || 0;

  return (
    <div
      className={cn(
        "relative w-24 flex flex-col items-center gap-1",
        isFolded && "opacity-50"
      )}
    >
      {/* Bet amount */}
      {bet > 0 && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
          {bet}
        </div>
      )}

      {/* Hole cards */}
      <div className="flex gap-0.5 h-12">
        {!isFolded && (showCards || isMe) && holeCards?.length === 2 ? (
          <>
            <PlayingCard card={holeCards[0]} size="sm" />
            <PlayingCard card={holeCards[1]} size="sm" />
          </>
        ) : !isFolded ? (
          <>
            <PlayingCard faceDown size="sm" />
            <PlayingCard faceDown size="sm" />
          </>
        ) : null}
      </div>

      {/* Player info */}
      <div
        className={cn(
          "w-full rounded-lg p-2 text-center transition-all",
          isCurrentTurn
            ? "bg-yellow-500 text-black ring-2 ring-yellow-300"
            : "bg-gray-800 text-white",
          isMe && !isCurrentTurn && "ring-2 ring-blue-500"
        )}
      >
        <div className="flex items-center justify-center gap-1">
          {isDealer && (
            <span className="bg-white text-black text-xs font-bold px-1 rounded">
              D
            </span>
          )}
          <span className="text-xs font-medium truncate max-w-16">
            {player.name}
          </span>
        </div>
        <div className="text-xs opacity-80">{player.chips}</div>
        {isAllIn && (
          <div className="text-xs text-red-400 font-bold">ALL IN</div>
        )}
      </div>
    </div>
  );
}
