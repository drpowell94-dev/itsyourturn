import type { GameType } from "@/lib/games";

// Per-game hand-calculator keypads. Every key adds its value to the running
// total; the total commits to a player's next empty round.
export type CalcKey = { label: string; sub?: string; value: number };
export type CalcConfig = {
  heading: string;
  cols: 2 | 3;
  keys: CalcKey[];
  /** Show the ×2 op (Flip 7's x2 card doubles the round total). */
  showDouble?: boolean;
};

export const CALC_CONFIGS: Partial<Record<GameType, CalcConfig>> = {
  // Card values 0–12, +15 bonus for flipping seven, ×2 multiplier card.
  flip7: {
    heading: "Hand calculator",
    cols: 3,
    keys: [
      ...Array.from({ length: 12 }, (_, i) => ({ label: String(i + 1), value: i + 1 })),
      { label: "0", value: 0 },
      { label: "+15", sub: "7-card bonus", value: 15 },
    ],
    showDouble: true,
  },
  // Leftover cards: 1–9 score 5, 10–12 score 10, Skip 15, Wild 25.
  phase10: {
    heading: "Leftover cards",
    cols: 2,
    keys: [
      { label: "1–9", sub: "+5", value: 5 },
      { label: "10–12", sub: "+10", value: 10 },
      { label: "Skip", sub: "+15", value: 15 },
      { label: "Wild", sub: "+25", value: 25 },
    ],
  },
  // Cards caught in opponents' hands: face value, action 20, wild 50.
  uno: {
    heading: "Cards caught",
    cols: 3,
    keys: [
      ...Array.from({ length: 10 }, (_, i) => ({ label: String(i), value: i })),
      { label: "Action", sub: "+20", value: 20 },
      { label: "Wild", sub: "+50", value: 50 },
    ],
  },
  // Common Farkle bank amounts.
  farkle: {
    heading: "Bank the dice",
    cols: 3,
    keys: [50, 100, 150, 200, 250, 300, 400, 500, 1000].map((v) => ({
      label: v === 1000 ? "1,000" : String(v),
      value: v,
    })),
  },
  // One point per heart, thirteen for the Queen of Spades.
  hearts: {
    heading: "Count the pain",
    cols: 2,
    keys: [
      { label: "♥", sub: "+1 each", value: 1 },
      { label: "Q♠", sub: "+13", value: 13 },
    ],
  },
};
