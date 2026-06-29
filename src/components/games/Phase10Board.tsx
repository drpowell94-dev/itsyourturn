import { useEffect, useRef, useState } from "react";
import { Plus, X, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Calculator } from "@/components/Calculator";
import { CALC_CONFIGS } from "@/lib/calculators";
import { Confetti } from "@/components/Confetti";
import { selectOnFocus } from "@/components/TargetInput";
import { Reader } from "@/components/Reader";
import { phase10Reader } from "@/lib/reader";

const PHASES = [
  "2 sets of 3",
  "1 set of 3 + 1 run of 4",
  "1 set of 4 + 1 run of 4",
  "1 run of 7",
  "1 run of 8",
  "1 run of 9",
  "2 sets of 4",
  "7 cards of one color",
  "1 set of 5 + 1 set of 2",
  "1 set of 5 + 1 set of 3",
];

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
  isHost: boolean;
  onWinner: (
    winnerInitials: string | null,
    playerSnapshot: { initials: string; total: number; rounds: (number | null)[] }[],
  ) => void;
  onNewGame: () => void;
};

const VISIBLE_ROUNDS = 3;

export function Phase10Board({
  players, setPlayers, maxRound, setMaxRound, canEdit, ownerIdForNew, isHost, onWinner, onNewGame,
}: Props) {
  const [roundOffset, setRoundOffset] = useState(0);
  const [showPhases, setShowPhases] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [newPlayerInitials, setNewPlayerInitials] = useState("");
  const [confirmNewRound, setConfirmNewRound] = useState(false);
  const [pendingMissing, setPendingMissing] = useState<{ round: number; playerIds: string[] } | null>(null);
  const prevRoundRef = useRef<number>(-1);
  const showDialogRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const total = (pl: Phase10Player) => pl.rounds.reduce<number>((acc, r) => acc + (r ?? 0), 0);
  const phaseOf = (pl: Phase10Player) => pl.phase ?? 1;

  // A round only counts toward ranking once every player has scored it.
  const roundIsComplete = (r: number) => players.length > 0 && players.every((p) => p.rounds[r] != null);
  const rankedTotal = (pl: Phase10Player) =>
    pl.rounds.reduce<number>((acc, r, i) => acc + (roundIsComplete(i) ? (r ?? 0) : 0), 0);

  // Winner: any player with phase > 10. If multiple, lowest completed-round total wins.
  const finished = players.filter((p) => phaseOf(p) > 10);
  const winner = finished.length > 0
    ? [...finished].sort((a, b) => total(a) - total(b))[0]
    : null;

  // Sort: finished first, then by furthest phase, then by lowest completed-round total.
  const sorted = [...players].sort((a, b) => {
    const fa = phaseOf(a) > 10 ? 1 : 0;
    const fb = phaseOf(b) > 10 ? 1 : 0;
    if (fa !== fb) return fb - fa;
    if (phaseOf(a) !== phaseOf(b)) return phaseOf(b) - phaseOf(a);
    return rankedTotal(a) - rankedTotal(b);
  });

  const [savedWinnerId, setSavedWinnerId] = useState<string | null>(null);
  useEffect(() => {
    if (!winner) setSavedWinnerId(null);
  }, [winner?.id]);

  // Calculate current round
  const handIsPlayed = (r: number) => players.some((p) => p.rounds[r] != null);
  let currentRound = 0;
  while (roundIsComplete(currentRound)) currentRound++;

  // Auto-scroll to keep currentRound visible and check for missing scores
  useEffect(() => {
    // Blur focused input when moving to next round
    if (prevRoundRef.current >= 0 && prevRoundRef.current !== currentRound) {
      if (inputRef.current && inputRef.current === document.activeElement) {
        inputRef.current.blur();
      }
      const prevRound = prevRoundRef.current;
      const missing = players
        .filter((p) => p.rounds[prevRound] == null)
        .map((p) => p.id);
      if (missing.length > 0) {
        setPendingMissing({ round: prevRound, playerIds: missing });
        showDialogRef.current = false;
      }
    }
    prevRoundRef.current = currentRound;

    // Show dialog when first score is entered in new round
    if (pendingMissing && !showDialogRef.current && handIsPlayed(currentRound)) {
      showDialogRef.current = true;
    }

    // Grow maxRound if needed
    if (currentRound >= maxRound) {
      setMaxRound((m) => Math.max(m, currentRound + 1));
    }

    // Auto-scroll to keep current round visible
    const visibleStart = roundOffset;
    const visibleEnd = roundOffset + VISIBLE_ROUNDS - 1;
    if (currentRound < visibleStart) {
      setRoundOffset(Math.max(0, currentRound - 1));
    } else if (currentRound > visibleEnd) {
      setRoundOffset(currentRound - VISIBLE_ROUNDS + 1);
    }
  }, [currentRound, players, pendingMissing, maxRound]);

  const confirmAddPlayer = () => {
    if (!newPlayerInitials.trim()) return;
    setPlayers((p) => [
      ...p,
      { id: crypto.randomUUID(), initials: newPlayerInitials.toUpperCase().slice(0, 3), rounds: Array(maxRound).fill(null), phase: 1, ownerId: ownerIdForNew },
    ]);
    setNewPlayerInitials("");
    setAddingPlayer(false);
  };

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

  const visibleRounds = Array.from(
    { length: Math.min(VISIBLE_ROUNDS, Math.max(1, maxRound - roundOffset)) },
    (_, i) => roundOffset + i
  );

  let playedHandsCount = 0;
  for (let r = 0; r < maxRound; r++) if (handIsPlayed(r)) playedHandsCount++;

  const rowGrid =
    "grid grid-cols-[3rem_4.5rem_2.5rem_1fr_1.75rem] sm:grid-cols-[4.5rem_5.5rem_3.5rem_1fr_2.5rem] gap-1.5 sm:gap-2 items-center";
  const roundsGrid = "grid grid-cols-3 gap-1 items-center";

  return (
    <>
      <section className="card-pop overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 border-b border-line">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setRoundOffset((o) => Math.max(0, o - 1))}
                disabled={roundOffset === 0}
                aria-label="View previous rounds"
                className="p-0.5 text-ink/40 hover:text-ink disabled:invisible transition-colors"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="microcap">
                Round <span className="text-accent font-semibold">{currentRound + 1}</span>
              </span>
              <button
                onClick={() => setRoundOffset((o) => Math.min(Math.max(0, maxRound - VISIBLE_ROUNDS), o + 1))}
                disabled={roundOffset + VISIBLE_ROUNDS >= maxRound}
                aria-label="View next rounds"
                className="p-0.5 text-ink/40 hover:text-ink disabled:invisible transition-colors"
              >
                <ChevronRight size={13} />
              </button>
            </div>
            <span className="microcap">{playedHandsCount} completed</span>
          </div>
          <span className="microcap">Clear all 10 phases</span>
        </div>

        {winner && winner.initials && (
          <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 bg-accent-soft border-b border-line">
            <span className="font-display font-bold text-base">
              🏆 {winner.initials} clears phase 10 at {total(winner)} points!
            </span>
            {isHost && (
              savedWinnerId === winner.id ? (
                <span className="microcap text-accent">Saved ✓</span>
              ) : (
                <button
                  onClick={() => {
                    setSavedWinnerId(winner.id);
                    onWinner(
                      winner.initials || "???",
                      sorted.map((p) => ({ initials: p.initials || "???", total: total(p), rounds: p.rounds })),
                    );
                  }}
                  className="btn btn-accent px-3 py-1 text-xs shrink-0"
                >
                  Save score
                </button>
              )
            )}
          </div>
        )}

        {/* Column header */}
        <div className={`${rowGrid} px-3 sm:px-4 py-2 border-b border-line`}>
          <span className="microcap">Player</span>
          <span className="microcap text-center">Phase</span>
          <span className="microcap text-right">Total</span>
          <div className={roundsGrid}>
            {visibleRounds.map((r) => (
              <span key={r} className="microcap text-center font-semibold text-accent">R{r + 1}</span>
            ))}
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
                    {visibleRounds.map((r) => {
                      const isCurrentRound = r === currentRound;
                      return (
                        <input
                          key={r}
                          ref={isCurrentRound ? inputRef : null}
                          type="text"
                          inputMode="numeric"
                          value={pl.rounds[r] ?? ""}
                          onChange={(e) => updateScore(pl.id, r, e.target.value)}
                          onFocus={selectOnFocus}
                          readOnly={!canEdit(pl)}
                          placeholder="–"
                          aria-label={`Round ${r + 1} score${isCurrentRound ? " (current)" : ""}`}
                          className={`w-full min-w-0 text-center font-mono tabular-nums text-sm sm:text-base text-ink border-2 rounded-lg outline-none py-1.5 placeholder:text-ink/25 transition-colors ${
                            isCurrentRound
                              ? "bg-accent text-white border-accent font-semibold shadow-[0_0_0_3px_rgba(255,151,102,0.2)]"
                              : "bg-paper border-line focus:border-accent"
                          }`}
                        />
                      );
                    })}
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

      <div className="grid grid-cols-3 gap-2 mt-5">
        <button
          onClick={() => setShowPhases(true)}
          className="btn btn-white py-2.5 text-sm"
        >
          See phases
        </button>
        <button
          onClick={() => confirmNewRound ? (onNewGame(), setConfirmNewRound(false)) : setConfirmNewRound(true)}
          className={`btn py-2.5 text-sm ${
            confirmNewRound
              ? "bg-coral text-white border-coral"
              : "btn-white"
          }`}
        >
          {confirmNewRound ? "Confirm?" : "New game"}
        </button>
        <button
          onClick={() => setAddingPlayer(true)}
          className="btn btn-accent py-2.5 text-sm flex items-center justify-center gap-1.5"
        >
          <Plus size={15} /> Add
        </button>
      </div>

      {addingPlayer && (
        <div className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface rounded-2xl border-2 border-ink shadow-[0_4px_0_var(--ink)] p-5 fade-in">
            <h2 className="font-display font-bold text-2xl mb-4">Player name</h2>
            <input
              type="text"
              value={newPlayerInitials}
              onChange={(e) => setNewPlayerInitials(e.target.value.toUpperCase().slice(0, 3))}
              onKeyDown={(e) => e.key === "Enter" && confirmAddPlayer()}
              autoFocus
              placeholder="ABC"
              maxLength={3}
              className="w-full font-mono font-semibold text-center text-sm bg-paper border-2 border-line rounded-lg focus:border-accent outline-none px-3 py-2 mb-4 transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={confirmAddPlayer}
                disabled={!newPlayerInitials.trim()}
                className="btn btn-accent flex-1 py-2.5 text-sm disabled:opacity-40"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setAddingPlayer(false);
                  setNewPlayerInitials("");
                }}
                className="btn btn-white flex-1 py-2.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingMissing && showDialogRef.current && (
        <div className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface rounded-2xl border-2 border-ink shadow-[0_4px_0_var(--ink)] p-5 fade-in">
            <h2 className="font-display font-bold text-2xl mb-4">Record 0 for missing scores?</h2>
            <p className="text-sm text-ink/60 mb-4">
              These players haven't entered a score for Round {pendingMissing.round + 1}. Record 0 for them?
            </p>
            <div className="border-t border-line mb-4 max-h-40 overflow-y-auto">
              {players
                .filter((p) => pendingMissing.playerIds.includes(p.id))
                .map((p) => (
                  <div key={p.id} className="py-2 border-b border-line last:border-b-0">
                    <span className="font-mono font-semibold tracking-[0.15em] text-sm">
                      {p.initials || "???"}
                    </span>
                  </div>
                ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPlayers((p) =>
                    p.map((x) => {
                      if (!pendingMissing.playerIds.includes(x.id)) return x;
                      const rounds = [...x.rounds];
                      while (rounds.length <= pendingMissing.round) rounds.push(null);
                      if (rounds[pendingMissing.round] === null) rounds[pendingMissing.round] = 0;
                      return { ...x, rounds };
                    }),
                  );
                  setPendingMissing(null);
                  showDialogRef.current = false;
                  prevRoundRef.current = currentRound;
                }}
                className="btn btn-accent flex-1 py-2.5 text-sm"
              >
                Record 0 & continue
              </button>
              <button
                onClick={() => {
                  setPendingMissing(null);
                  showDialogRef.current = false;
                }}
                className="btn btn-white flex-1 py-2.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <Calculator
        config={CALC_CONFIGS.phase10!}
        players={players.filter(canEdit).map((p) => ({ id: p.id, initials: p.initials }))}
        onAssign={addScoreToPlayer}
      />
      <Confetti active={!!winner} />

      {showPhases && (
        <div className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface rounded-2xl border-2 border-ink shadow-[0_4px_0_var(--ink)] p-5 fade-in">
            <div className="microcap mb-1">Phase 10</div>
            <h2 className="font-display font-bold text-2xl mb-4">All 10 phases</h2>
            <ul className="border-t border-line mb-5">
              {PHASES.map((desc, i) => (
                <li key={i} className="flex items-baseline gap-3 py-2.5 border-b border-line">
                  <span className="font-mono font-semibold text-accent tabular-nums text-sm w-6 shrink-0">{i + 1}</span>
                  <span className="text-sm text-ink/80">{desc}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setShowPhases(false)}
              className="btn btn-accent w-full py-2.5 text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
