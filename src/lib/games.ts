export type GameType = "flip7" | "phase10" | "spades";

export const GAME_LABELS: Record<GameType, string> = {
  flip7: "Flip 7",
  phase10: "Phase 10",
  spades: "Spades",
};

export function isGameType(v: unknown): v is GameType {
  return v === "flip7" || v === "phase10" || v === "spades";
}
