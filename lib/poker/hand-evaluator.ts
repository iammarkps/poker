// Hand rankings from lowest to highest
export enum HandRank {
  HIGH_CARD = 1,
  ONE_PAIR = 2,
  TWO_PAIR = 3,
  THREE_OF_A_KIND = 4,
  STRAIGHT = 5,
  FLUSH = 6,
  FULL_HOUSE = 7,
  FOUR_OF_A_KIND = 8,
  STRAIGHT_FLUSH = 9,
  ROYAL_FLUSH = 10,
}

export const HAND_NAMES: Record<HandRank, string> = {
  [HandRank.HIGH_CARD]: "High Card",
  [HandRank.ONE_PAIR]: "One Pair",
  [HandRank.TWO_PAIR]: "Two Pair",
  [HandRank.THREE_OF_A_KIND]: "Three of a Kind",
  [HandRank.STRAIGHT]: "Straight",
  [HandRank.FLUSH]: "Flush",
  [HandRank.FULL_HOUSE]: "Full House",
  [HandRank.FOUR_OF_A_KIND]: "Four of a Kind",
  [HandRank.STRAIGHT_FLUSH]: "Straight Flush",
  [HandRank.ROYAL_FLUSH]: "Royal Flush",
};

export interface EvaluatedHand {
  rank: HandRank;
  name: string;
  values: number[]; // For comparison (highest first)
  cards: string[]; // Best 5 cards
}

const RANK_VALUES: Record<string, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

function parseCard(card: string): { rank: number; suit: string } {
  const rank = RANK_VALUES[card.slice(0, -1)];
  const suit = card.slice(-1);
  return { rank, suit };
}

function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];

  const [first, ...rest] = arr;
  const withFirst = getCombinations(rest, k - 1).map((combo) => [first, ...combo]);
  const withoutFirst = getCombinations(rest, k);

  return [...withFirst, ...withoutFirst];
}

function evaluateFiveCards(cards: string[]): EvaluatedHand {
  const parsed = cards.map(parseCard);
  const ranks = parsed.map((c) => c.rank).sort((a, b) => b - a);
  const suits = parsed.map((c) => c.suit);

  // Check for flush
  const isFlush = suits.every((s) => s === suits[0]);

  // Check for straight
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  let isStraight = false;
  let straightHighCard = 0;

  if (uniqueRanks.length === 5) {
    // Regular straight
    if (uniqueRanks[0] - uniqueRanks[4] === 4) {
      isStraight = true;
      straightHighCard = uniqueRanks[0];
    }
    // Wheel (A-2-3-4-5)
    if (
      uniqueRanks[0] === 14 &&
      uniqueRanks[1] === 5 &&
      uniqueRanks[2] === 4 &&
      uniqueRanks[3] === 3 &&
      uniqueRanks[4] === 2
    ) {
      isStraight = true;
      straightHighCard = 5; // 5-high straight
    }
  }

  // Count ranks
  const rankCounts = new Map<number, number>();
  for (const rank of ranks) {
    rankCounts.set(rank, (rankCounts.get(rank) || 0) + 1);
  }

  const counts = Array.from(rankCounts.entries())
    .sort((a, b) => {
      // Sort by count desc, then by rank desc
      if (b[1] !== a[1]) return b[1] - a[1];
      return b[0] - a[0];
    });

  // Determine hand rank
  if (isFlush && isStraight) {
    if (straightHighCard === 14) {
      return {
        rank: HandRank.ROYAL_FLUSH,
        name: HAND_NAMES[HandRank.ROYAL_FLUSH],
        values: [straightHighCard],
        cards,
      };
    }
    return {
      rank: HandRank.STRAIGHT_FLUSH,
      name: HAND_NAMES[HandRank.STRAIGHT_FLUSH],
      values: [straightHighCard],
      cards,
    };
  }

  if (counts[0][1] === 4) {
    return {
      rank: HandRank.FOUR_OF_A_KIND,
      name: HAND_NAMES[HandRank.FOUR_OF_A_KIND],
      values: [counts[0][0], counts[1][0]],
      cards,
    };
  }

  if (counts[0][1] === 3 && counts[1][1] === 2) {
    return {
      rank: HandRank.FULL_HOUSE,
      name: HAND_NAMES[HandRank.FULL_HOUSE],
      values: [counts[0][0], counts[1][0]],
      cards,
    };
  }

  if (isFlush) {
    return {
      rank: HandRank.FLUSH,
      name: HAND_NAMES[HandRank.FLUSH],
      values: ranks,
      cards,
    };
  }

  if (isStraight) {
    return {
      rank: HandRank.STRAIGHT,
      name: HAND_NAMES[HandRank.STRAIGHT],
      values: [straightHighCard],
      cards,
    };
  }

  if (counts[0][1] === 3) {
    return {
      rank: HandRank.THREE_OF_A_KIND,
      name: HAND_NAMES[HandRank.THREE_OF_A_KIND],
      values: [counts[0][0], ...counts.slice(1).map((c) => c[0])],
      cards,
    };
  }

  if (counts[0][1] === 2 && counts[1][1] === 2) {
    const higherPair = Math.max(counts[0][0], counts[1][0]);
    const lowerPair = Math.min(counts[0][0], counts[1][0]);
    const kicker = counts[2][0];
    return {
      rank: HandRank.TWO_PAIR,
      name: HAND_NAMES[HandRank.TWO_PAIR],
      values: [higherPair, lowerPair, kicker],
      cards,
    };
  }

  if (counts[0][1] === 2) {
    return {
      rank: HandRank.ONE_PAIR,
      name: HAND_NAMES[HandRank.ONE_PAIR],
      values: [counts[0][0], ...counts.slice(1).map((c) => c[0])],
      cards,
    };
  }

  return {
    rank: HandRank.HIGH_CARD,
    name: HAND_NAMES[HandRank.HIGH_CARD],
    values: ranks,
    cards,
  };
}

export function evaluateHand(holeCards: string[], communityCards: string[]): EvaluatedHand {
  const allCards = [...holeCards, ...communityCards];
  const combinations = getCombinations(allCards, 5);

  let bestHand: EvaluatedHand | null = null;

  for (const combo of combinations) {
    const evaluated = evaluateFiveCards(combo);

    if (!bestHand || compareHands(evaluated, bestHand) > 0) {
      bestHand = evaluated;
    }
  }

  return bestHand!;
}

export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  // Compare ranks first
  if (a.rank !== b.rank) {
    return a.rank - b.rank;
  }

  // Compare values (kickers)
  for (let i = 0; i < Math.min(a.values.length, b.values.length); i++) {
    if (a.values[i] !== b.values[i]) {
      return a.values[i] - b.values[i];
    }
  }

  return 0; // Tie
}
