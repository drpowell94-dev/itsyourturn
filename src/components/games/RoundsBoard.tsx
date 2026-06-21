import { useEffect, useRef, useState } from "react";
import { Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Calculator } from "@/components/Calculator";
import type { CalcConfig } from "@/lib/calculators";
import { Confetti } from "@/components/Confetti";
import { Reader } from "@/components/Reader";
import { TargetInput, selectOnFocus } from "@/components/TargetInput";
import { roundsReader } from "@/lib/reader";

export type RoundsPlayer = {
  id: string;
  initials: string;
  rounds: (number | null)[];
  ownerId?: string | null;
};

type Props = {
  players: RoundsPlayer[];
  setPlayers: (updater: (p: RoundsPlayer[]) => RoundsPlayer[]) => void;
  maxRound: number;
  setMaxRound: (updater: (n: number) => number) => void;
  targetScore: number;
  setTargetScore: (n: number) => void;
  /** false: first to the target wins (UNO, Farkle).
   *  true: the game ends when anyone reaches the target; lowest total wins (Hearts). */
  lowWins: boolean;
  /** Game-specific hand calculator keypad; omit to hide the calculator. */
  calcConfig?: CalcConfig;
  canEdit: (p: RoundsPlayer) => boolean;
  ownerIdForNew: string | null;
  onWinner: (
    winnerInitials: string | null,
    playerSnapshot: { initials: string; total: number; rounds: (number | null)[] }[],
  ) => void;
  onNewGame: () => void;
  gameType?: string;
};

const VISIBLE_ROUNDS = 3;

export function RoundsBoard({
  players, setPlayers, maxRound, setMaxRound, targetScore, setTargetScore,
  lowWins, calcConfig, canEdit, ownerIdForNew, onWinner, onNewGame, gameType,
}: Props) {
  const [roundOffset, setRoundOffset] = useState(0);
  const [confirmNewRound, setConfirmNewRound] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [newPlayerInitials, setNewPlayerInitials] = useState("");
  const [showMissingScoresDialog, setShowMissingScoresDialog] = useState(false);
  const [missingScoresRound, setMissingScoresRound] = useState<number | null>(null);
  const prevCurrentRoundRef = useRef(-1);

  // Reset round offset when starting a new game
  useEffect(() => {
    if (players.length === 0) {
      setRoundOffset(0);
      setConfirmNewRound(false);
    }
  }, [players.length]);

  const total = (pl: RoundsPlayer) => pl.rounds.reduce<number>((acc, r) => acc + (r ?? 0), 0);
  // Standings: best player first in either direction.
  const sorted = [...players].sort((a, b) => (lowWins ? total(a) - total(b) : total(b) - total(a)));
  // In UNO with target score: first player to reach target LOSES
  // In other games: best-ranked player wins
  const gameOver = players.some((p) => total(p) >= targetScore);
  let winner = null;
  if (gameOver && sorted.length > 0) {
    if (gameType === "uno" && !lowWins) {
      // UNO: the person who reached the target (highest score) is the loser
      const sortedByScore = [...players].sort((a, b) => total(b) - total(a));
      winner = sortedByScore[0]; // Highest scorer = first to reach target = loser
    } else {
      // Other games: best-ranked player wins
      winner = sorted[0];
    }
  }

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
  }, [winner?.id, onWinner, sorted]);

  // Auto-scroll to keep current round visible
  useEffect(() => {
    const roundHasAnyEntry = (r: number) => players.some((p) => p.rounds[r] != null);
    const roundIsComplete = (r: number) => players.length > 0 && players.every((p) => p.rounds[r] != null);

    let curr = 0;
    while (roundHasAnyEntry(curr)) curr++;

    if (curr !== prevCurrentRoundRef.current) {
      const prevRound = prevCurrentRoundRef.current;
      prevCurrentRoundRef.current = curr;

      if (prevRound >= 0 && roundHasAnyEntry(prevRound) && !roundIsComplete(prevRound)) {
        setMissingScoresRound(prevRound);
        setShowMissingScoresDialog(true);
      }

      const newOffset = Math.max(0, curr - 1);
      setRoundOffset(newOffset);
    }
  }, [players, maxRound]);

  const confirmAddPlayer = () => {
    if (!newPlayerInitials.trim()) return;
    setPlayers((p) => [
      ...p,
      { id: crypto.randomUUID(), initials: newPlayerInitials.toUpperCase().slice(0, 3), rounds: Array(maxRound).fill(null), ownerId: ownerIdForNew },
    ]);
    setNewPlayerInitials("");
    setAddingPlayer(false);
  };

  const setAllCurrentRoundToZero = () => {
    const roundHasAnyEntry = (r: number) => players.some((p) => p.rounds[r] != null);
    let curr = 0;
    while (roundHasAnyEntry(curr)) curr++;

    setPlayers((p) =>
      p.map((x) => {
        const rounds = [...x.rounds];
        while (rounds.length <= curr) rounds.push(null);
        if (rounds[curr] === null) rounds[curr] = 0;
        return { ...x, rounds };
      }),
    );
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
    if (num !== null) setMaxRound((m) => Math.max(m, round + 1));
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

  const visibleRounds = Array.from({ length: VISIBLE_ROUNDS }, (_, i) => roundOffset + i);
  const canPrev = roundOffset > 0;
  const goNext = () => {
    const newOffset = roundOffset + 1;
    if (newOffset + VISIBLE_ROUNDS > maxRound) setMaxRound(() => newOffset + VISIBLE_ROUNDS);
    setRoundOffset(newOffset);
  };

  // "Current hand" = first round where no player has a score yet.
  const roundHasAnyEntry = (r: number) => players.some((p) => p.rounds[r] != null);
  const roundIsComplete = (r: number) => players.length > 0 && players.every((p) => p.rounds[r] != null);

  let currentRound = 0;
  while (roundHasAnyEntry(currentRound)) currentRound++;

  let startedRounds = 0;
  let completedRounds = 0;
  for (let r = 0; r < maxRound; r++) {
    if (roundHasAnyEntry(r)) startedRounds++;
    if (roundIsComplete(r)) completedRounds++;
  }

  const hasAnyScore = players.some((p) => p.rounds.some((r) => r != null));

  const rowGrid =
    "grid grid-cols-[3.2rem_3.6rem_1fr_2rem] sm:grid-cols-[4.5rem_4.5rem_1fr_2.5rem] gap-2 items-center";
  const roundsGrid = "grid grid-cols-[1.5rem_repeat(3,minmax(0,1fr))_1.5rem] gap-1 items-center";

  return (
    <>
      <section className="card-pop overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 border-b border-line">
          <div className="flex items-center gap-4">
            <span className="microcap">
              Round <span className="text-accent font-semibold">{currentRound + 1}</span>
            </span>
            <span className="microcap">{completedRounds} complete</span>
          </div>
          <label className="microcap flex items-center gap-1.5">
            {lowWins ? "Ends at" : "To"}
            <TargetInput
              value={targetScore}
              onCommit={setTargetScore}
              maxDigits={5}
              className="w-18 text-center font-mono font-semibold text-sm text-accent bg-paper border-2 border-line rounded-lg focus:border-accent outline-none py-0.5 transition-colors"
            />
          </label>
        </div>

        {winner && winner.initials && (
          <div className={`px-3 sm:px-4 py-2.5 border-b border-line ${
            gameType === "uno" && !lowWins ? "bg-coral/20" : "bg-accent-soft"
          }`}>
            <span className="font-display font-bold text-base">
              {gameType === "uno" && !lowWins
                ? `💔 ${winner.initials} busted at ${total(winner)}!`
                : lowWins
                ? `🏆 ${winner.initials} wins low with ${total(winner)}!`
                : `🏆 ${winner.initials} takes it with ${total(winner)}!`}
            </span>
          </div>
        )}

        {/* Column header */}
        <div className={`${rowGrid} px-3 sm:px-4 py-2 border-b border-line`}>
          <span className="microcap">Player</span>
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
            {sorted.map((pl, idx) => {
              const isWinner = winner?.id === pl.id;
              const leading = idx === 0 && hasAnyScore;
              const atLimit = total(pl) >= targetScore;
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
                  <span
                    className={`text-right font-mono font-semibold tabular-nums text-base sm:text-lg ${
                      atLimit && lowWins ? "text-coral" : leading || isWinner ? "text-accent" : "text-ink"
                    }`}
                  >
                    {total(pl)}
                  </span>
                  <div className={roundsGrid}>
                    <span />
                    {visibleRounds.map((r) => {
                      const isCurrentRound = r === currentRound;
                      return (
                        <input
                          key={r}
                          type="text"
                          inputMode="numeric"
                          value={pl.rounds[r] ?? ""}
                          onChange={(e) => updateScore(pl.id, r, e.target.value)}
                          onFocus={selectOnFocus}
                          readOnly={!canEdit(pl)}
                          placeholder="0"
                          aria-label={`Round ${r + 1} score${isCurrentRound ? " (current)": ""}`}
                          className={`w-full min-w-0 text-center font-mono tabular-nums text-sm sm:text-base text-ink border-2 rounded-lg outline-none py-1.5 placeholder:text-ink/25 transition-colors ${
                            isCurrentRound
                              ? "bg-accent-soft border-accent focus:border-accent"
                              : "bg-paper border-line focus:border-accent"
                          }`}
                        />
                      );
                    })}
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
        text={roundsReader(
          players.map((p) => ({ initials: p.initials, total: total(p) })),
          targetScore,
          lowWins,
          gameType,
        )}
      />

      <div className="grid grid-cols-2 gap-2 mt-5">
        <button
          onClick={() => confirmNewRound ? (onNewGame(), setConfirmNewRound(false)) : setConfirmNewRound(true)}
          className={`btn py-2.5 text-sm ${
            confirmNewRound
              ? "bg-coral text-white border-coral"
              : "btn-white"
          }`}
        >
          {confirmNewRound ? "Sure?" : "New game"}
        </button>
        <button
          onClick={() => setAddingPlayer(true)}
          className="btn btn-accent py-2.5 text-sm flex items-center justify-center gap-1.5"
        >
          <Plus size={15} /> Add player
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

      {showMissingScoresDialog && missingScoresRound !== null && (
        <div className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface rounded-2xl border-2 border-ink shadow-[0_4px_0_var(--ink)] p-5 fade-in">
            <h2 className="font-display font-bold text-2xl mb-3">Round {missingScoresRound + 1}</h2>
            <p className="text-sm text-ink/70 mb-4">
              Some players haven&rsquo;t entered their score. Record 0 for them?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setAllCurrentRoundToZero();
                  setShowMissingScoresDialog(false);
                }}
                className="btn btn-accent flex-1 py-2.5 text-sm"
              >
                Record 0
              </button>
              <button
                onClick={() => setShowMissingScoresDialog(false)}
                className="btn btn-white flex-1 py-2.5 text-sm"
              >
                Wait
              </button>
            </div>
          </div>
        </div>
      )}

      {calcConfig && (
        <Calculator
          config={calcConfig}
          players={players.filter(canEdit).map((p) => ({ id: p.id, initials: p.initials }))}
          onAssign={addScoreToPlayer}
        />
      )}
      <Confetti active={!!winner} />
    </>
  );
}
