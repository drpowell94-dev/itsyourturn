import { useEffect, useRef, useState } from "react";
import { Plus, X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Calculator } from "@/components/Calculator";
import { CALC_CONFIGS } from "@/lib/calculators";
import { Confetti } from "@/components/Confetti";
import { selectOnFocus } from "@/components/TargetInput";
import { Reader } from "@/components/Reader";
import { phase10Reader } from "@/lib/reader";

export type Phase10Player = {
  id: string;
  initials: string;
  rounds: (number | null)[];
  phase?: number; // current phase 1..10; 11 means all phases complete
  ownerId?: string | null;
};

type Props = {
  players: Phase10Player[];
  setPlayers: (updater: (p: Phase10Player[]) => Phase10Player[]) => void;
  maxRound: number;
  setMaxRound: (updater: (n: number) => number) => void;
  canEdit: (p: Phase10Player) => boolean;
  ownerIdForNew: string | null;
  onWinner: (
    winnerInitials: string | null,
    playerSnapshot: { initials: string; total: number; rounds: (number | null)[] }[],
  ) => void;
  onNewGame: () => void;
};

const VISIBLE_ROUNDS = 3;

export function Phase10Board({
  players, setPlayers, maxRound, setMaxRound, canEdit, ownerIdForNew, onWinner, onNewGame,
}: Props) {
  const [roundOffset, setRoundOffset] = useState(0);

  const total = (pl: Phase10Player) => pl.rounds.reduce<number>((acc, r) => acc + (r ?? 0), 0);
  const phaseOf = (pl: Phase10Player) => pl.phase ?? 1;

  // A round only counts toward ranking once every player has scored it.
  const roundIsComplete = (r: number) => players.every((p) => p.rounds[r] != null);
  const rankedTotal = (pl: Phase10Player) =>
    pl.rounds.reduce<number>((acc, r, i) => acc + (roundIsComplete(i) ? (r ?? 0) : 0), 0);

  // Winner: any player with phase > 10. If multiple, lowest completed-round total wins.
  const finished = players.filter((p) => phaseOf(p) > 10);
  const winner = finished.length > 0
    ? [...finished].sort((a, b) => rankedTotal(a) - rankedTotal(b))[0]
    : null;

  // Sort: finished first, then by furthest phase, then by lowest completed-round total.
  const sorted = [...players].sort((a, b) => {
    const fa = phaseOf(a) > 10 ? 1 : 0;
    const fb = phaseOf(b) > 10 ? 1 : 0;
    if (fa !== fb) return fb - fa;
    if (phaseOf(a) !== phaseOf(b)) return phaseOf(b) - phaseOf(a);
    return rankedTotal(a) - rankedTotal(b);
  });

  const savedWinnerRef = useRef<string | null>(null);
  useEffect(() => {
    if (winner && savedWinnerRef.current !== winner.id) {
      savedWinnerRef.current = winner.id;
      onWinner(
        winner.initials || "???",
        sorted.map((p) => ({ initials: p.initials || "???", total: total(p), rounds: p.rounds })),
      );
    }
    if (!winner) savedWinnerRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner?.id]);

  const addPlayer = () =>
    setPlayers((p) => [
      ...p,
      { id: crypto.randomUUID(), initials: "", rounds: Array(maxRound).fill(null), phase: 1, ownerId: ownerIdForNew },
    ]);

  const removePlayer = (id: string) =>
    setPlayers((p) => {
      const t = p.find((x) => x.id === id);
      if (t && !canEdit(t)) return p;
      return p.filter((x) => x.id !== id);
    });

  const updateInitials = (id: string, v: string) => {
    const t = players.find((x) => x.id === id);
    if (t && !canEdit(t)) return;
    setPlayers((p) => p.map((x) => (x.id === id ? { ...x, initials: v.toUpperCase().slice(0, 3) } : x)));
  };

  const updateScore = (id: string, round: number, v: string) => {
    const t = players.find((x) => x.id === id);
    if (t && !canEdit(t)) return;
    if (v.includes("-")) return;
    const num = v === "" ? null : parseInt(v, 10);
    if (v !== "" && Number.isNaN(num as number)) return;
    setPlayers((p) =>
      p.map((x) => {
        if (x.id !== id) return x;
        const rounds = [...x.rounds];
        while (rounds.length <= round) rounds.push(null);
        rounds[round] = num;
        return { ...x, rounds };
      }),
    );
  };

  const addScoreToPlayer = (id: string, value: number) => {
    const t = players.find((x) => x.id === id);
    if (t && !canEdit(t)) return;
    let grewTo = 0;
    setPlayers((p) =>
      p.map((x) => {
        if (x.id !== id) return x;
        const rounds = [...x.rounds];
        const idx = rounds.findIndex((r) => r === null);
        if (idx === -1) { rounds.push(value); grewTo = rounds.length; }
        else { rounds[idx] = value; }
        return { ...x, rounds };
      }),
    );
    if (grewTo > 0) setMaxRound((m) => Math.max(m, grewTo));
  };

  const bumpPhase = (id: string, delta: number) => {
    const t = players.find((x) => x.id === id);
    if (t && !canEdit(t)) return;
    setPlayers((p) =>
      p.map((x) => {
        if (x.id !== id) return x;
        const next = Math.max(1, Math.min(11, phaseOf(x) + delta));
        return { ...x, phase: next };
      }),
    );
  };

  const visibleRounds = Array.from({ length: VISIBLE_ROUNDS }, (_, i) => roundOffset + i);
  const canPrev = roundOffset > 0;
  const goNext = () => {
    const newOffset = roundOffset + 1;
    if (newOffset + VISIBLE_ROUNDS > maxRound) setMaxRound(() => newOffset + VISIBLE_ROUNDS);
    setRoundOffset(newOffset);
  };

  const handIsPlayed = (r: number) => players.some((p) => p.rounds[r] != null);
  let currentRound = 0;
  while (handIsPlayed(currentRound)) currentRound++;
  let playedHandsCount = 0;
  for (let r = 0; r < maxRound; r++) if (handIsPlayed(r)) playedHandsCount++;

  const rowGrid =
    "grid grid-cols-[3rem_4.5rem_2.5rem_1fr_1.75rem] sm:grid-cols-[4.5rem_5.5rem_3.5rem_1fr_2.5rem] gap-1.5 sm:gap-2 items-center";
  const roundsGrid = "grid grid-cols-[1.25rem_repeat(3,minmax(0,1fr))_1.25rem] gap-1 items-center";

  return (
    <>
      <section className="card-pop overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 border-b border-line">
          <div className="flex items-center gap-4">
            <span className="microcap">
              Hand <span className="text-accent font-semibold">{currentRound + 1}</span>
            </span>
            <span className="microcap">Played {playedHandsCount}</span>
          </div>
          <span className="microcap">Clear all 10 phases</span>
        </div>

        {winner && winner.initials && (
          <div className="px-3 sm:px-4 py-2.5 bg-accent-soft border-b border-line">
            <span className="font-display font-bold text-base">
              🏆 {winner.initials} clears phase 10 at {total(winner)} points!
            </span>
          </div>
        )}

        {/* Column header */}
        <div className={`${rowGrid} px-3 sm:px-4 py-2 border-b border-line`}>
          <span className="microcap">Player</span>
          <span className="microcap text-center">Phase</span>
          <span className="microcap text-right">Total</span>
          <div className={roundsGrid}>
            <button
              onClick={() => canPrev && setRoundOffset(roundOffset - 1)}
              disabled={!canPrev}
              aria-label="Earlier rounds"
              className="text-ink/40 hover:text-accent disabled:opacity-25 flex justify-center transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            {visibleRounds.map((r) => (
              <span key={r} className="microcap text-center">R{r + 1}</span>
            ))}
            <button
              onClick={goNext}
              aria-label="Later rounds"
              className="text-ink/40 hover:text-accent flex justify-center transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <span />
        </div>

        {players.length === 0 ? (
          <div className="flex items-center justify-center min-h-[200px] px-6">
            <p className="font-display font-semibold text-lg text-ink/50 text-center">
              A fresh sheet! Add a player below to get going.
            </p>
          </div>
        ) : (
          <div>
            {sorted.map((pl) => {
              const ph = phaseOf(pl);
              const done = ph > 10;
              const isWinner = winner?.id === pl.id;
              return (
                <div
                  key={pl.id}
                  className={`${rowGrid} px-3 sm:px-4 py-2.5 border-b border-line last:border-b-0 transition-colors ${
                    isWinner ? "bg-accent-soft" : ""
                  }`}
                >
                  <input
                    value={pl.initials}
                    onChange={(e) => updateInitials(pl.id, e.target.value)}
                    placeholder="···"
                    maxLength={3}
                    readOnly={!canEdit(pl)}
                    aria-label="Player initials"
                    className="w-full min-w-0 font-mono font-semibold tracking-[0.15em] text-sm sm:text-base text-ink uppercase bg-paper border-2 border-line rounded-lg focus:border-accent outline-none text-center py-1.5 placeholder:text-ink/25 transition-colors"
                  />
                  <div className="flex items-center justify-center gap-0.5">
                    <button
                      onClick={() => bumpPhase(pl.id, -1)}
                      disabled={!canEdit(pl) || ph <= 1}
                      aria-label="Previous phase"
                      className="w-6 h-8 rounded-lg bg-accent-soft text-accent font-bold disabled:opacity-25 text-sm hover:brightness-95 transition-all"
                    >
                      −
                    </button>
                    <span
                      className={`w-7 text-center font-mono font-semibold tabular-nums text-sm sm:text-base ${
                        done ? "text-accent" : "text-ink"
                      }`}
                    >
                      {done ? <Check size={14} className="inline" /> : ph}
                    </span>
                    <button
                      onClick={() => bumpPhase(pl.id, 1)}
                      disabled={!canEdit(pl) || ph >= 11}
                      aria-label="Next phase"
                      className="w-6 h-8 rounded-lg bg-accent-soft text-accent font-bold disabled:opacity-25 text-sm hover:brightness-95 transition-all"
                    >
                      +
                    </button>
                  </div>
                  <span
                    className={`text-right font-mono font-semibold tabular-nums text-base sm:text-lg ${
                      isWinner ? "text-accent" : "text-ink"
                    }`}
                  >
                    {total(pl)}
                  </span>
                  <div className={roundsGrid}>
                    <span />
                    {visibleRounds.map((r) => (
                      <input
                        key={r}
                        type="text"
                        inputMode="numeric"
                        value={pl.rounds[r] ?? ""}
                        onChange={(e) => updateScore(pl.id, r, e.target.value)}
                        onFocus={selectOnFocus}
                        readOnly={!canEdit(pl)}
                        placeholder="–"
                        aria-label={`Round ${r + 1} score`}
                        className="w-full min-w-0 text-center font-mono tabular-nums text-sm sm:text-base text-ink bg-paper border-2 border-line rounded-lg focus:border-accent outline-none py-1.5 placeholder:text-ink/25 transition-colors"
                      />
                    ))}
                    <span />
                  </div>
                  <button
                    onClick={() => removePlayer(pl.id)}
                    disabled={!canEdit(pl)}
                    aria-label="Remove player"
                    className="flex justify-center items-center h-9 text-ink/30 hover:text-coral disabled:opacity-20 transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Reader
        text={phase10Reader(
          players.map((p) => ({ initials: p.initials, total: total(p), phase: phaseOf(p) })),
        )}
      />

      <div className="grid grid-cols-2 gap-2 mt-5">
        <button onClick={onNewGame} className="btn btn-white py-2.5 text-sm">
          New round
        </button>
        <button
          onClick={addPlayer}
          className="btn btn-accent py-2.5 text-sm flex items-center justify-center gap-1.5"
        >
          <Plus size={15} /> Add player
        </button>
      </div>

      <Calculator
        config={CALC_CONFIGS.phase10!}
        players={players.filter(canEdit).map((p) => ({ id: p.id, initials: p.initials }))}
        onAssign={addScoreToPlayer}
      />
      <Confetti active={!!winner} />
    </>
  );
}
