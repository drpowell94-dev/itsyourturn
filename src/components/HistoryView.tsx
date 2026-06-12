import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getHistory, clearHistory, type HistoryGame } from "@/lib/history";

export type HistoryViewProps = {
  /** Game PIN. When provided, loads per-PIN history from the server.
   *  When omitted, loads global local history. */
  sessionId?: string | null;
  /** Show the clear button (only valid for global local history). */
  showClear?: boolean;
};

type Row = {
  id: string;
  date: string;
  winner: string | null;
  targetScore: number;
  players: { initials: string; total: number }[];
};

function fromLocal(g: HistoryGame): Row {
  return {
    id: g.id,
    date: g.date,
    winner: g.winner,
    targetScore: g.targetScore,
    players: g.players.map((p) => ({ initials: p.initials, total: p.total })),
  };
}

export function HistoryView({ sessionId, showClear = false }: HistoryViewProps) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!sessionId) {
      setRows(getHistory().map(fromLocal));
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from("game_history")
        .select("id, winner, target_score, players, completed_at")
        .eq("pin", sessionId)
        .order("completed_at", { ascending: false });
      if (!cancelled && data) {
        setRows(
          (data as any[]).map((g) => ({
            id: g.id,
            date: g.completed_at,
            winner: g.winner,
            targetScore: g.target_score,
            players: g.players ?? [],
          })),
        );
      }
    };
    load();
    const channel = supabase
      .channel(`session-history-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_history", filter: `pin=eq.${sessionId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const onClear = () => {
    if (confirm("Clear all game history?")) {
      clearHistory();
      setRows([]);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="card-pop flex items-center justify-center min-h-[180px]">
        <p className="font-display font-semibold text-lg text-ink/50 text-center px-6">
          Nothing on the record yet — finished games land here!
        </p>
      </div>
    );
  }

  return (
    <div>
      {showClear && !sessionId && (
        <div className="flex justify-end mb-3">
          <button
            onClick={onClear}
            className="text-xs font-bold text-ink/50 underline underline-offset-4 decoration-2 decoration-line hover:text-coral hover:decoration-current transition-colors"
          >
            Clear history
          </button>
        </div>
      )}
      <ul className="border-t border-line">
        {rows.map((g) => (
          <li key={g.id} className="py-4 border-b border-line">
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
              <span className="font-mono text-xs text-ink/50">
                {new Date(g.date).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <span className="microcap">Target {g.targetScore}</span>
            </div>
            {g.winner && (
              <p className="font-display font-bold text-base mb-2">
                <span className="mr-1.5">🏆</span>
                {g.winner} took the game!
              </p>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {g.players.map((p, i) => (
                <span key={i} className="font-mono text-sm tabular-nums">
                  <span className={p.initials === g.winner ? "text-accent font-semibold" : "text-ink/70"}>
                    {p.initials}
                  </span>{" "}
                  <span className="text-ink">{p.total}</span>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
