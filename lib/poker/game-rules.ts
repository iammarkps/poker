import type { Hand, PlayerHand, Player } from "@/lib/supabase/types";

export type ActionType = "fold" | "check" | "call" | "raise" | "all_in";

export interface ValidAction {
  type: ActionType;
  minAmount?: number;
  maxAmount?: number;
}

export function getValidActions(
  hand: Hand,
  playerHand: PlayerHand,
  player: Player,
  bigBlind: number
): ValidAction[] {
  const actions: ValidAction[] = [];

  // Always can fold
  actions.push({ type: "fold" });

  const toCall = hand.current_bet - playerHand.current_bet;
  const remainingChips = player.chips;

  if (toCall === 0) {
    // No bet to match, can check
    actions.push({ type: "check" });
  } else if (remainingChips <= toCall) {
    // Can only go all-in
    actions.push({ type: "all_in", minAmount: remainingChips, maxAmount: remainingChips });
  } else {
    // Can call
    actions.push({ type: "call", minAmount: toCall, maxAmount: toCall });
  }

  // Can raise if have enough chips
  const minRaise = hand.current_bet + bigBlind;
  if (remainingChips > toCall && remainingChips >= minRaise - playerHand.current_bet) {
    if (remainingChips === minRaise - playerHand.current_bet) {
      // Can only raise to exactly one amount (all-in)
      actions.push({ type: "all_in", minAmount: remainingChips, maxAmount: remainingChips });
    } else {
      actions.push({
        type: "raise",
        minAmount: minRaise,
        maxAmount: remainingChips + playerHand.current_bet,
      });
    }
  }

  return actions;
}

export function isActionValid(
  action: ActionType,
  amount: number | undefined,
  validActions: ValidAction[]
): boolean {
  const validAction = validActions.find((a) => a.type === action);

  if (!validAction) return false;

  if (action === "fold" || action === "check") {
    return true;
  }

  if (amount === undefined) return false;

  if (validAction.minAmount !== undefined && amount < validAction.minAmount) {
    return false;
  }

  if (validAction.maxAmount !== undefined && amount > validAction.maxAmount) {
    return false;
  }

  return true;
}

export function getNextActivePlayer(
  currentSeat: number,
  players: Player[],
  playerHands: Map<string, PlayerHand>,
  maxSeats: number = 9
): number | null {
  const activePlayers = players.filter((p) => {
    const ph = playerHands.get(p.id);
    return ph && !ph.is_folded && !ph.is_all_in;
  });

  if (activePlayers.length === 0) return null;

  // Find next active player after current seat
  for (let i = 1; i <= maxSeats; i++) {
    const nextSeat = (currentSeat + i) % maxSeats;
    const player = activePlayers.find((p) => p.seat === nextSeat);
    if (player) {
      return nextSeat;
    }
  }

  return null;
}

export function isBettingRoundComplete(
  players: Player[],
  playerHands: Map<string, PlayerHand>,
  currentBet: number
): boolean {
  const activePlayers = players.filter((p) => {
    const ph = playerHands.get(p.id);
    return ph && !ph.is_folded;
  });

  // All active players must have acted and matched the current bet (or be all-in)
  return activePlayers.every((p) => {
    const ph = playerHands.get(p.id)!;
    return ph.has_acted && (ph.current_bet === currentBet || ph.is_all_in);
  });
}

export function countActivePlayers(
  players: Player[],
  playerHands: Map<string, PlayerHand>
): number {
  return players.filter((p) => {
    const ph = playerHands.get(p.id);
    return ph && !ph.is_folded;
  }).length;
}
