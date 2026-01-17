import { evaluateHand, compareHands, type EvaluatedHand } from "./hand-evaluator";
import type { Player, PlayerHand } from "@/lib/supabase/types";

export interface WinnerResult {
  playerId: string;
  amount: number;
  hand?: EvaluatedHand;
}

interface PlayerWithHand {
  player: Player;
  playerHand: PlayerHand;
  evaluatedHand: EvaluatedHand;
  contribution: number; // Total chips contributed to pot
}

export function determineWinners(
  players: Player[],
  playerHands: PlayerHand[],
  communityCards: string[]
): WinnerResult[] {
  // Get active players (not folded)
  const activePlayers = players.filter((p) => {
    const ph = playerHands.find((h) => h.player_id === p.id);
    return ph && !ph.is_folded;
  });

  // If only one player left, they win the entire pot
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    // Use total_contributed to get full pot (all rounds), not just current_bet
    const totalPot = playerHands.reduce(
      (sum, ph) => sum + (ph.total_contributed ?? ph.current_bet),
      0
    );
    return [{ playerId: winner.id, amount: totalPot }];
  }

  // Evaluate all hands
  const playersWithHands: PlayerWithHand[] = activePlayers.map((player) => {
    const playerHand = playerHands.find((h) => h.player_id === player.id)!;
    const evaluatedHand = evaluateHand(playerHand.hole_cards, communityCards);
    return {
      player,
      playerHand,
      evaluatedHand,
      contribution: playerHand.total_contributed ?? playerHand.current_bet,
    };
  });

  // Handle side pots
  const results: WinnerResult[] = [];
  const allContributions = playerHands.map(
    (ph) => ph.total_contributed ?? ph.current_bet
  );
  const uniqueContributions = [...new Set(allContributions)].sort((a, b) => a - b);

  let previousLevel = 0;

  for (const level of uniqueContributions) {
    if (level === 0) continue;

    // Calculate pot for this level
    const levelDiff = level - previousLevel;
    const eligiblePlayers = playersWithHands.filter((p) => p.contribution >= level);
    // Use total_contributed for all players (including folded) who contributed at this level
    const contributorsAtLevel = playerHands.filter(
      (ph) => (ph.total_contributed ?? ph.current_bet) >= previousLevel
    );

    const potForLevel = levelDiff * contributorsAtLevel.length;

    if (eligiblePlayers.length === 0) continue;

    // Find winner(s) for this pot
    let bestHand = eligiblePlayers[0].evaluatedHand;
    let winners = [eligiblePlayers[0]];

    for (let i = 1; i < eligiblePlayers.length; i++) {
      const comparison = compareHands(eligiblePlayers[i].evaluatedHand, bestHand);
      if (comparison > 0) {
        bestHand = eligiblePlayers[i].evaluatedHand;
        winners = [eligiblePlayers[i]];
      } else if (comparison === 0) {
        winners.push(eligiblePlayers[i]);
      }
    }

    // Split pot among winners
    const sharePerWinner = Math.floor(potForLevel / winners.length);
    const remainder = potForLevel % winners.length;

    for (let i = 0; i < winners.length; i++) {
      const existingResult = results.find((r) => r.playerId === winners[i].player.id);
      const share = sharePerWinner + (i < remainder ? 1 : 0);

      if (existingResult) {
        existingResult.amount += share;
      } else {
        results.push({
          playerId: winners[i].player.id,
          amount: share,
          hand: winners[i].evaluatedHand,
        });
      }
    }

    previousLevel = level;
  }

  return results;
}
