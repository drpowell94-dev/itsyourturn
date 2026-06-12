import { useState } from "react";
import { Calculator as CalcIcon, X, Delete } from "lucide-react";

type Player = { id: string; initials: string };

type Props = {
  players: Player[];
  onAssign: (playerId: string, sum: number) => void;
};

// Flip 7 round calculator. Each key press adds that card's value to the
// running total; ×2 doubles it; +15 adds the Flip 7 bonus; "=" commits the
// total to the selected player's next empty round.
export function Calculator({ players, onAssign }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<number[]>([]);
  const [target, setTarget] = useState<string>("");

  const total = entries.reduce((a, b) => a + b, 0);

  const press = (d: string) => {
    const n = parseInt(d, 10);
    if (Number.isNaN(n)) return;
    setEntries((e) => [...e, n]);
  };
  const addBonus = () => setEntries((e) => [...e, 15]);
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
        className="fixed bottom-5 right-5 z-40 bg-accent text-paper rounded-full shadow-lg w-13 h-13 p-3.5 flex items-center justify-center hover:scale-105 transition-transform"
      >
        <CalcIcon size={22} />
      </button>
    );
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  const keyCls =
    "py-2.5 rounded-md border border-line bg-paper font-mono text-sm text-ink hover:border-accent hover:text-accent transition-colors";

  return (
    <div className="fixed bottom-5 right-5 z-40 w-72 bg-surface rounded-xl border border-line shadow-xl p-3.5 fade-in">
      <div className="flex items-center justify-between mb-3">
        <span className="microcap">Hand calculator</span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="text-ink/40 hover:text-ink transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="border border-line rounded-lg px-3 py-2.5 mb-3 flex items-baseline justify-between">
        <span className="microcap">This hand</span>
        <span className="font-mono font-semibold tabular-nums text-3xl text-accent leading-none">
          {total}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 mb-1.5">
        {keys.map((k) => (
          <button key={k} onClick={() => press(k)} className={keyCls}>
            {k}
          </button>
        ))}
        <button onClick={back} aria-label="Backspace" className={`${keyCls} flex items-center justify-center`}>
          <Delete size={15} />
        </button>
        <button onClick={() => press("0")} className={keyCls}>
          0
        </button>
        <button
          onClick={assign}
          disabled={!target || total === 0}
          aria-label="Commit score"
          className="py-2.5 rounded-md bg-accent text-paper font-mono text-sm disabled:opacity-35 transition-opacity"
        >
          =
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5 mb-3">
        <button onClick={doubleTotal} className={`${keyCls} text-xs`}>×2</button>
        <button onClick={addBonus} className={`${keyCls} text-xs`}>+15</button>
        <button onClick={clear} className={`${keyCls} text-xs`}>Clear</button>
      </div>

      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        aria-label="Assign to player"
        className="w-full bg-paper text-ink font-mono text-sm rounded-md border border-line py-2.5 px-2 mb-2 outline-none focus:border-accent transition-colors"
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
        className="w-full py-2.5 rounded-md bg-accent text-paper text-sm font-medium disabled:opacity-35 transition-opacity"
      >
        Add {total} to player
      </button>
    </div>
  );
}
