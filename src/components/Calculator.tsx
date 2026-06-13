import { useState } from "react";
import { Calculator as CalcIcon, X, Delete } from "lucide-react";
import type { CalcConfig } from "@/lib/calculators";

type Player = { id: string; initials: string };

type Props = {
  config: CalcConfig;
  players: Player[];
  onAssign: (playerId: string, sum: number) => void;
};

// Game-aware hand calculator. Each key press adds that card/score to the
// running total; ×2 (where the game has one) doubles it; the total commits
// to the selected player's next empty round.
export function Calculator({ config, players, onAssign }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<number[]>([]);
  const [target, setTarget] = useState<string>("");

  const total = entries.reduce((a, b) => a + b, 0);

  const press = (v: number) => setEntries((e) => [...e, v]);
  const doubleTotal = () =>
    setEntries((e) => {
      const t = e.reduce((a, b) => a + b, 0);
      return t === 0 ? e : [...e, t];
    });
  const back = () => setEntries((e) => e.slice(0, -1));
  const clear = () => setEntries([]);

  const assign = () => {
    if (!target || total === 0) return;
    const value = total;
    const pid = target;
    setEntries([]);
    setOpen(false);
    onAssign(pid, value);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open hand calculator"
        className="btn btn-accent fixed bottom-5 right-5 z-40 rounded-full! w-13 h-13 p-3.5 flex items-center justify-center"
      >
        <CalcIcon size={22} />
      </button>
    );
  }

  const keyCls =
    "rounded-xl border-2 border-line bg-paper text-ink hover:border-accent hover:text-accent active:scale-95 transition-all flex flex-col items-center justify-center py-2 min-h-10";
  const utilityCols = config.showDouble ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className="fixed bottom-5 right-5 z-40 w-72 bg-surface rounded-2xl border-2 border-ink shadow-[0_4px_0_var(--ink)] p-3.5 fade-in">
      <div className="flex items-center justify-between mb-3">
        <span className="microcap">{config.heading}</span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="text-ink/40 hover:text-ink transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="bg-accent-soft border-2 border-line rounded-xl px-3 py-2.5 mb-3">
        <div className="flex items-baseline justify-between">
          <span className="microcap">This hand</span>
          <span className="font-mono font-bold tabular-nums text-3xl text-accent leading-none">
            {total}
          </span>
        </div>
        {entries.length > 0 && (
          <div className="mt-1 flex justify-end overflow-hidden">
            <span className="font-mono text-[10px] text-ink/45 whitespace-nowrap">
              {entries.join(" + ")}
            </span>
          </div>
        )}
      </div>

      <div className={`grid gap-1.5 mb-1.5 ${config.cols === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {config.keys.map((k, i) => (
          <button key={i} onClick={() => press(k.value)} className={keyCls}>
            <span className="font-display font-bold text-sm leading-tight">{k.label}</span>
            {k.sub && (
              <span className="text-[9px] font-bold text-ink/45 leading-tight">{k.sub}</span>
            )}
          </button>
        ))}
      </div>

      <div className={`grid ${utilityCols} gap-1.5 mb-3`}>
        <button
          onClick={back}
          aria-label="Undo last entry"
          className={`${keyCls} flex-row gap-1 text-xs font-display font-bold`}
        >
          <Delete size={13} /> Undo
        </button>
        {config.showDouble && (
          <button onClick={doubleTotal} className={`${keyCls} text-xs font-display font-bold`}>
            ×2
          </button>
        )}
        <button onClick={clear} className={`${keyCls} text-xs font-display font-bold`}>
          Clear
        </button>
      </div>

      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        aria-label="Assign to player"
        className="w-full bg-paper text-ink font-display font-bold text-sm rounded-xl border-2 border-line py-2.5 px-2 mb-2.5 outline-none focus:border-accent transition-colors"
      >
        <option value="">Select player…</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.initials || "???"}
          </option>
        ))}
      </select>

      <button
        onClick={assign}
        disabled={!target || total === 0}
        className="btn btn-accent w-full py-2.5 text-sm"
      >
        Add {total} to player
      </button>
    </div>
  );
}
