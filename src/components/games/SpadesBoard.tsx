import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { Confetti } from "@/components/Confetti";
import { TargetInput, selectOnFocus } from "@/components/TargetInput";
import { Reader } from "@/components/Reader";
import { spadesReader } from "@/lib/reader";

export type SpadesPlayer = {
  id: string;
  initials: string;
  /** Auto-computed per-round score. Read-only in the UI. */
  rounds: (number | null)[];
  /** Per-round bid (0-13). null = not entered. */
  bids?: (number | null)[];
  /** Per-round tricks taken (0-13). null = not entered. */
  tricks?: (number | null)[];
  ownerId?: string | null;
};

type Props = {
  players: SpadesPlayer[];
  setPlayers: (updater: (p: SpadesPlayer[]) => SpadesPlayer[]) => void;
  maxRound: number;
  setMaxRound: (updater: (n: number) => number) => void;
  targetScore: number;
  setTargetScore: (n: number) => void;
  canEdit: (p: SpadesPlayer) => boolean;
  ownerIdForNew: string | null;
  onWinner: (
    winnerInitials: string | null,
    playerSnapshot: { initials: string; total: number; rounds: (number | null)[] }[],
  ) => void;
  onNewGame: () => void;
};

const VISIBLE_ROUNDS = 3;
const TRICKS_PER_HAND = 13;

/**
 * Simple, consistent scoring formula (NOT full Spades rules):
 *   - made bid (tricks >= bid):  bid * 10 + (tricks - bid)
 *   - missed bid (tricks < bid): -bid * 10
 * Nil/blind nil/bags/etc. are intentionally not modeled.
 */
function roundScore(bid: number, tricks: number): number {
  if (tricks >= bid) return bid * 10 + (tricks - bid);
  return -bid * 10;
}

function isValidCount(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= TRICKS_PER_HAND;
}

export function SpadesBoard({
  players, setPlayers, maxRound, setMaxRound, targetScore, setTargetScore,
  canEdit, ownerIdForNew, onWinner, onNewGame,
}: Props) {
  const [roundOffset, setRoundOffset] = useState(0);
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  const [pendingMissing, setPendingMissing] = useState<{ round: number; playerIds: string[] } | null>(null);
  const prevRoundRef = useRef<number>(-1);
  const showDialogRef = useRef(false);

  // Ensure fixed Team A / Team B exist. Spades is team-based, so we don't
  // allow add/remove. If the session arrives empty (fresh game), seed it.
  useEffect(() => {
    if (players.length === 2 && players[0]?.initials && players[1]?.initials) return;
    if (players.length === 0) {
      setPlayers(() => [
        { id: crypto.randomUUID(), initials: "SPADES", rounds: [], bids: [], tricks: [], ownerId: ownerIdForNew },
        { id: crypto.randomUUID(), initials: "HEARTS", rounds: [], bids: [], tricks: [], ownerId: ownerIdForNew },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.length]);

  const total = (pl: SpadesPlayer) => pl.rounds.reduce<number>((acc, r) => acc + (r ?? 0), 0);
  // In Spades the highest score wins once any team reaches the target.
  const sorted = [...players].sort((a, b) => total(b) - total(a));
  const winner = sorted.length > 0 && total(sorted[0]) >= targetScore ? sorted[0] : null;

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

  const updateInitials = (id: string, v: string) => {
    const t = players.find((x) => x.id === id);
    if (t && !canEdit(t)) return;
    setPlayers((p) => p.map((x) => (x.id === id ? { ...x, initials: v.toUpperCase().slice(0, 6) } : x)));
  };

  /**
   * Recompute one round's score for both teams. A round is finalized (and
   * its score written) ONLY when both teams have a valid bid and valid
   * tricks, and tricks sum to exactly TRICKS_PER_HAND. Otherwise both
   * teams' round entries are cleared (null).
   */
  const recomputeRound = (list: SpadesPlayer[], round: number): SpadesPlayer[] => {
    if (list.length !== 2) return list;
    const [a, b] = list;
    const ab = a.bids?.[round] ?? null;
    const bb = b.bids?.[round] ?? null;
    const at = a.tricks?.[round] ?? null;
    const bt = b.tricks?.[round] ?? null;
    const finalized =
      isValidCount(ab) && isValidCount(bb) &&
      isValidCount(at) && isValidCount(bt) &&
      at + bt === TRICKS_PER_HAND;
    const aScore = finalized ? roundScore(ab as number, at as number) : null;
    const bScore = finalized ? roundScore(bb as number, bt as number) : null;
    const writeRound = (pl: SpadesPlayer, v: number | null): SpadesPlayer => {
      const rounds = [...pl.rounds];
      while (rounds.length <= round) rounds.push(null);
      rounds[round] = v;
      return { ...pl, rounds };
    };
    return [writeRound(a, aScore), writeRound(b, bScore)];
  };

  const parseCount = (v: string): number | null | "invalid" => {
    if (v === "") return null;
    if (!/^\d+$/.test(v)) return "invalid";
    const n = parseInt(v, 10);
    if (!Number.isInteger(n) || n < 0 || n > TRICKS_PER_HAND) return "invalid";
    return n;
  };

  const updateBid = (id: string, round: number, v: string) => {
    const t = players.find((x) => x.id === id);
    if (t && !canEdit(t)) return;
    const parsed = parseCount(v);
    if (parsed === "invalid") return;
    setPlayers((p) => {
      const next = p.map((x) => {
        if (x.id !== id) return x;
        const bids = [...(x.bids ?? [])];
        while (bids.length <= round) bids.push(null);
        bids[round] = parsed;
        return { ...x, bids };
      });
      return recomputeRound(next, round);
    });
  };

  const updateTricks = (id: string, round: number, v: string) => {
    const t = players.find((x) => x.id === id);
    if (t && !canEdit(t)) return;
    const parsed = parseCount(v);
    if (parsed === "invalid") return;
    setPlayers((p) => {
      const next = p.map((x) => {
        if (x.id !== id) return x;
        const tricks = [...(x.tricks ?? [])];
        while (tricks.length <= round) tricks.push(null);
        tricks[round] = parsed;
        return { ...x, tricks };
      });
      return recomputeRound(next, round);
    });
  };

  const canPrev = roundOffset > 0;
  const goNext = () => {
    const newOffset = roundOffset + 1;
    if (newOffset + VISIBLE_ROUNDS > maxRound) setMaxRound(() => newOffset + VISIBLE_ROUNDS);
    setRoundOffset(newOffset);
  };

  const roundIsFinalized = (round: number): boolean => {
    if (players.length !== 2) return false;
    return players[0].rounds[round] != null && players[1].rounds[round] != null;
  };
  const roundTrickSum = (round: number): number | null => {
    if (players.length !== 2) return null;
    const at = players[0].tricks?.[round];
    const bt = players[1].tricks?.[round];
    if (!isValidCount(at) || !isValidCount(bt)) return null;
    return at + bt;
  };

  // The "current hand" is the first non-finalized round at/after roundOffset.
  let currentRound = roundOffset;
  while (roundIsFinalized(currentRound)) currentRound++;
  // Check for incomplete rounds and handle missing scores confirmation
  useEffect(() => {
    if (players.length !== 2) return;

    if (prevRoundRef.current !== -1 && prevRoundRef.current !== currentRound) {
      const prevRound = prevRoundRef.current;
      const missing = players
        .filter((p) => {
          const bid = p.bids?.[prevRound] ?? null;
          const tricks = p.tricks?.[prevRound] ?? null;
          return bid === null || tricks === null;
        })
        .map((p) => p.id);
      if (missing.length > 0) {
        setPendingMissing({ round: prevRound, playerIds: missing });
        showDialogRef.current = true;
      }
    }
    prevRoundRef.current = currentRound;

    if (currentRound >= maxRound) setMaxRound(() => currentRound + 1);
  }, [currentRound, players, maxRound, setMaxRound]);

  const playedRounds = (() => {
    const out: number[] = [];
    for (let r = 0; r < maxRound; r++) if (roundIsFinalized(r)) out.push(r);
    return out;
  })();

  const bump = (id: string, round: number, kind: "bid" | "tricks", delta: number) => {
    const pl = players.find((x) => x.id === id);
    if (!pl || !canEdit(pl)) return;
    const cur = (kind === "bid" ? pl.bids?.[round] : pl.tricks?.[round]) ?? 0;
    const next = Math.max(0, Math.min(TRICKS_PER_HAND, cur + delta));
    if (kind === "bid") updateBid(id, round, String(next));
    else updateTricks(id, round, String(next));
  };

  const trickSum = roundTrickSum(currentRound);
  const trickSumOver = trickSum !== null && trickSum > TRICKS_PER_HAND;

  const TeamPanel = ({ pl, suit }: { pl: SpadesPlayer; suit: "♠" | "♥" }) => {
    const bid = pl.bids?.[currentRound] ?? null;
    const tricks = pl.tricks?.[currentRound] ?? null;
    const projected = isValidCount(bid) && isValidCount(tricks) ? roundScore(bid, tricks) : null;
    const isWinner = winner?.id === pl.id;
    const editable = canEdit(pl);

    return (
      <div
        className={`rounded-xl border-2 p-3.5 sm:p-4 transition-colors ${
          isWinner ? "bg-accent-soft border-accent/50" : "bg-paper border-line"
        }`}
      >
        <div className="flex items-end justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="microcap mb-1">{suit} Team</div>
            <input
              value={pl.initials}
              onChange={(e) => updateInitials(pl.id, e.target.value)}
              placeholder="NAME"
              maxLength={6}
              readOnly={!editable}
              aria-label="Team name"
              className="w-full font-display font-bold text-2xl sm:text-[26px] tracking-wide text-ink bg-transparent border-b-2 border-transparent focus:border-accent outline-none py-0.5 placeholder:text-ink/25 transition-colors"
            />
          </div>
          <div className="text-right">
            <div className="microcap mb-0.5">Total</div>
            <div
              className={`font-mono font-semibold tabular-nums text-3xl sm:text-4xl leading-none ${
                total(pl) >= targetScore ? "text-accent" : "text-ink"
              }`}
            >
              {total(pl)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stepper
            label="Bid"
            value={bid}
            disabled={!editable}
            onDec={() => bump(pl.id, currentRound, "bid", -1)}
            onInc={() => bump(pl.id, currentRound, "bid", +1)}
            onChange={(v) => updateBid(pl.id, currentRound, v)}
          />
          <Stepper
            label="Tricks"
            value={tricks}
            disabled={!editable}
            onDec={() => bump(pl.id, currentRound, "tricks", -1)}
            onInc={() => bump(pl.id, currentRound, "tricks", +1)}
            onChange={(v) => updateTricks(pl.id, currentRound, v)}
            warn={trickSumOver}
          />
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
          <span className="microcap">This hand</span>
          <span
            className={`font-mono font-semibold tabular-nums text-base ${
              projected === null
                ? "text-ink/30"
                : projected >= 0
                  ? "text-ink"
                  : "text-coral"
            }`}
          >
            {projected === null ? "—" : projected > 0 ? `+${projected}` : projected}
          </span>
        </div>
      </div>
    );
  };

  return (
    <>
      <section className="card-pop overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 border-b border-line">
          <div className="flex items-center gap-4">
            <span className="microcap">
              Round <span className="text-accent font-semibold">{currentRound + 1}</span>
            </span>
            <span className="microcap">{playedRounds.length} completed</span>
          </div>
          <label className="microcap flex items-center gap-1.5">
            To
            <TargetInput
              value={targetScore}
              onCommit={setTargetScore}
              className="w-14 text-center font-mono font-semibold text-sm text-accent bg-paper border-2 border-line rounded-lg focus:border-accent outline-none py-0.5 transition-colors"
            />
          </label>
        </div>

        {winner && winner.initials && (
          <div className="px-3 sm:px-4 py-2.5 bg-accent-soft border-b border-line">
            <span className="font-display font-bold text-base">
              🏆 {winner.initials} takes the match at {total(winner)}!
            </span>
          </div>
        )}

        {/* Two team panels */}
        {players.length !== 2 ? (
          <div className="flex items-center justify-center h-[220px]">
            <p className="font-display font-semibold text-lg text-ink/50">Setting up the two teams…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 p-2.5 sm:p-3">
            <TeamPanel pl={players[0]} suit="♠" />
            <TeamPanel pl={players[1]} suit="♥" />
          </div>
        )}

        {/* Hand status / validation */}
        {players.length === 2 && !winner && (
          <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2 border-t border-line">
            <span className="microcap">
              Tricks{" "}
              <span
                className={`font-semibold ${
                  trickSum === TRICKS_PER_HAND
                    ? "text-accent"
                    : trickSumOver
                      ? "text-coral"
                      : "text-ink/70"
                }`}
              >
                {trickSum ?? 0}/{TRICKS_PER_HAND}
              </span>
            </span>
            <button
              onClick={() => {
                if (players.length !== 2) return;
                if (!canEdit(players[0]) && !canEdit(players[1])) return;
                setPlayers((p) =>
                  p.map((x) => {
                    if (!canEdit(x)) return x;
                    const bids = [...(x.bids ?? [])]; bids[currentRound] = null;
                    const tricks = [...(x.tricks ?? [])]; tricks[currentRound] = null;
                    const rounds = [...x.rounds]; rounds[currentRound] = null;
                    return { ...x, bids, tricks, rounds };
                  }),
                );
              }}
              className="text-xs text-ink/50 underline underline-offset-4 decoration-line hover:text-accent hover:decoration-current transition-colors"
            >
              Clear hand
            </button>
          </div>
        )}
      </section>

      <Reader
        text={spadesReader(
          players.map((p) => ({ initials: p.initials, total: total(p) })),
          targetScore,
          trickSum,
          TRICKS_PER_HAND,
        )}
      />

      {/* Hand-by-hand log */}
      <section className="card-pop mt-5 p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="microcap">Score sheet</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => canPrev && setRoundOffset(roundOffset - 1)}
              disabled={!canPrev}
              aria-label="Previous hand"
              className="text-ink/40 hover:text-accent disabled:opacity-25 p-1 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={goNext}
              aria-label="Next hand"
              className="text-ink/40 hover:text-accent p-1 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {playedRounds.length === 0 ? (
          <p className="text-center text-sm text-ink/45 py-3">
            No hands on the sheet yet. Enter both teams&rsquo; bid and tricks above.
          </p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {playedRounds.map((r) => {
              const a = players[0];
              const b = players[1];
              const aScore = a.rounds[r] ?? 0;
              const bScore = b.rounds[r] ?? 0;
              return (
                <div
                  key={r}
                  className="shrink-0 w-24 rounded-xl border-2 border-line bg-paper p-2 text-center"
                >
                  <div className="microcap">Hand {r + 1}</div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1 font-mono tabular-nums text-xs font-semibold">
                    <span
                      title={`${a.initials} bid ${a.bids?.[r]} took ${a.tricks?.[r]}`}
                      className={aScore >= 0 ? "text-ink" : "text-coral"}
                    >
                      {aScore > 0 ? `+${aScore}` : aScore}
                    </span>
                    <span
                      title={`${b.initials} bid ${b.bids?.[r]} took ${b.tricks?.[r]}`}
                      className={bScore >= 0 ? "text-ink" : "text-coral"}
                    >
                      {bScore > 0 ? `+${bScore}` : bScore}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-ink/45 tabular-nums">
                    {a.bids?.[r]}/{a.tricks?.[r]} · {b.bids?.[r]}/{b.tricks?.[r]}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-5">
        <button
          onClick={() => confirmNewGame ? (onNewGame(), setConfirmNewGame(false)) : setConfirmNewGame(true)}
          className={`btn w-full py-2.5 text-sm ${
            confirmNewGame
              ? "bg-coral text-white border-coral"
              : "btn-white"
          }`}
        >
          {confirmNewGame ? "Confirm?" : "New game"}
        </button>
      </div>

      {pendingMissing && showDialogRef.current && (
        <div className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface rounded-2xl border-2 border-ink shadow-[0_4px_0_var(--ink)] p-5 fade-in">
            <h2 className="font-display font-bold text-2xl mb-4">Record bids and tricks for missing team?</h2>
            <p className="text-sm text-ink/60 mb-4">
              {players.find((p) => pendingMissing.playerIds.includes(p.id))?.initials || "A team"} hasn't entered their bid and tricks for Round {pendingMissing.round + 1}. Continue anyway?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPendingMissing(null);
                  showDialogRef.current = false;
                }}
                className="btn btn-white flex-1 py-2.5 text-sm"
              >
                Continue anyway
              </button>
              <button
                onClick={() => {
                  setPendingMissing(null);
                  showDialogRef.current = false;
                  prevRoundRef.current = -1;
                }}
                className="btn btn-accent flex-1 py-2.5 text-sm"
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      )}

      <Confetti active={!!winner} />
    </>
  );
}

function Stepper({
  label, value, disabled, onDec, onInc, onChange, warn = false,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  onDec: () => void;
  onInc: () => void;
  onChange: (v: string) => void;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border-2 bg-surface p-2 transition-colors ${
        warn ? "border-coral" : "border-line"
      }`}
    >
      <div className="microcap text-center">{label}</div>
      <div className="flex items-center gap-1 mt-1">
        <button
          type="button"
          onClick={onDec}
          disabled={disabled}
          aria-label={`Decrease ${label.toLowerCase()}`}
          className="shrink-0 h-9 w-9 rounded-lg border-2 border-line bg-paper text-ink/60 hover:border-accent hover:text-accent flex items-center justify-center disabled:opacity-25 active:scale-95 transition-all"
        >
          <Minus size={14} />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onFocus={selectOnFocus}
          readOnly={disabled}
          aria-label={label}
          placeholder="–"
          className="flex-1 min-w-0 text-center font-mono font-semibold tabular-nums text-xl text-ink bg-transparent outline-none placeholder:text-ink/25"
        />
        <button
          type="button"
          onClick={onInc}
          disabled={disabled}
          aria-label={`Increase ${label.toLowerCase()}`}
          className="shrink-0 h-9 w-9 rounded-lg border-2 border-line bg-paper text-ink/60 hover:border-accent hover:text-accent flex items-center justify-center disabled:opacity-25 active:scale-95 transition-all"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
