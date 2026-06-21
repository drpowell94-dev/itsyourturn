export type GameType =
  | "flip7"
  | "phase10"
  | "spades"
  | "uno"
  | "farkle"
  | "hearts"
  | "custom";

export const GAME_LABELS: Record<GameType, string> = {
  flip7: "Flip 7",
  phase10: "Phase 10",
  spades: "Spades",
  uno: "UNO",
  farkle: "Farkle",
  hearts: "Hearts",
  custom: "Your Game",
};

export const GAME_DEFAULT_TARGET: Record<GameType, number> = {
  flip7: 200,
  phase10: 200, // unused — Phase 10 has no target score
  spades: 500,
  uno: 500,
  farkle: 10000,
  hearts: 100,
  custom: 250,
};

/** Rules a host picks for a custom game; synced through the state blob. */
export type CustomRules = { name: string; lowWins: boolean; bust?: number | null };

export function isGameType(v: unknown): v is GameType {
  return typeof v === "string" && v in GAME_LABELS;
}
