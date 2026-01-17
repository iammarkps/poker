"use client";

import { useGame } from "@/components/game/game-provider";
import { Seat } from "./seat";
import { CommunityCards } from "./community-cards";
import { PotDisplay } from "./pot-display";

// Seat positions around an oval table (9 seats)
// Positions are percentages from center
const SEAT_POSITIONS = [
  { x: 50, y: 95 }, // 0 - bottom center (player's typical seat)
  { x: 15, y: 80 }, // 1 - bottom left
  { x: 5, y: 50 },  // 2 - left
  { x: 15, y: 20 }, // 3 - top left
  { x: 35, y: 5 },  // 4 - top left-center
  { x: 65, y: 5 },  // 5 - top right-center
  { x: 85, y: 20 }, // 6 - top right
  { x: 95, y: 50 }, // 7 - right
  { x: 85, y: 80 }, // 8 - bottom right
];

export function PokerTable() {
  const { players, hand, playerHands, myPlayer, myPlayerHand, winnerPlayerIds } = useGame();

  if (!hand) return null;

  // Create a map of seat number to player
  const seatToPlayer = new Map(players.map((p) => [p.seat, p]));
  const playerToHand = new Map(playerHands.map((ph) => [ph.player_id, ph]));

  // Reorder seats so current player is at the bottom
  const mySeat = myPlayer?.seat ?? 0;
  const reorderedSeats = Array.from({ length: 9 }, (_, i) => (i + mySeat) % 9);

  const showdownPhase = hand.phase === "showdown";

  return (
    <div className="relative w-full max-w-4xl aspect-[16/10]">
      {/* Table felt */}
      <div className="absolute inset-8 rounded-[50%] bg-gradient-to-b from-green-700 to-green-800 border-8 border-amber-900 shadow-2xl" />

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
        <PotDisplay
          pot={hand.pot}
          currentBet={hand.current_bet}
          myBet={myPlayerHand?.current_bet}
        />
        <CommunityCards cards={hand.community_cards} />
      </div>

      {/* Seats */}
      {reorderedSeats.map((seatNum, index) => {
        const position = SEAT_POSITIONS[index];
        const player = seatToPlayer.get(seatNum);
        const playerHand = player ? playerToHand.get(player.id) : undefined;

        // Get hole cards - only show own cards or winner's cards during showdown
        let holeCards: string[] | undefined;
        if (player?.id === myPlayer?.id && myPlayerHand) {
          // Always show own cards
          holeCards = myPlayerHand.hole_cards;
        } else if (showdownPhase && player && winnerPlayerIds.has(player.id) && playerHand) {
          // At showdown, only show winner's cards (losers muck)
          holeCards = playerHand.hole_cards;
        }

        const isWinner = showdownPhase && player && winnerPlayerIds.has(player.id);

        return (
          <div
            key={seatNum}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
            }}
          >
            <Seat
              player={player}
              playerHand={playerHand}
              holeCards={holeCards}
              isCurrentTurn={hand.current_seat === seatNum}
              isDealer={hand.dealer_seat === seatNum}
              isMe={player?.id === myPlayer?.id}
              showCards={!!(showdownPhase && isWinner)}
              isWinner={isWinner || false}
            />
          </div>
        );
      })}
    </div>
  );
}
