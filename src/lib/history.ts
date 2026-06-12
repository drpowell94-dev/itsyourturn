// Lightweight localStorage-backed game history store.
// No backend dependency — matches the client-only state model.
export type HistoryPlayer = { initials: string; total: number; rounds: (number | null)[] };
export type HistoryGame = {
  id: string;
  date: string; // ISO
  sessionId?: string; // stable id for the current game session — used to dedupe
  targetScore: number;
  players: HistoryPlayer[];
  winner: string | null; // initials
};

const KEY = "iyt-history";

export function getHistory(): HistoryGame[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveGame(game: Omit<HistoryGame, "id" | "date">) {
  if (typeof window === "undefined") return;
  const list = getHistory();
  // Dedupe: if a history entry already exists for this session, update it in
  // place (latest scores/winner) instead of creating a duplicate.
  if (game.sessionId) {
    const idx = list.findIndex((g) => g.sessionId === game.sessionId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...game, date: new Date().toISOString() };
      localStorage.setItem(KEY, JSON.stringify(list));
      return;
    }
  }
  const entry: HistoryGame = {
    ...game,
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify([entry, ...list]));
}

export function clearHistory() {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
}
