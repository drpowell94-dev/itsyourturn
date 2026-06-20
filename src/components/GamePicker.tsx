import { useState } from "react";
import { ArrowRight, HelpCircle, X } from "lucide-react";
import type { GameType } from "@/lib/games";
import { GAME_INSTRUCTIONS } from "@/lib/instructions";

type Props = {
  onSelect: (type: GameType) => void;
  onJoin: (pin: string) => void;
  onArchive: () => void;
};

const GAMES: {
  id: GameType;
  name: string;
  tag: string;
  desc: string;
  color: string; // suit-color token
  tilt: string;
}[] = [
  {
    id: "flip7",
    name: "Flip 7",
    tag: "Press your luck",
    desc: "First to 200. Bust if you flip a duplicate!",
    color: "var(--gold)",
    tilt: "hover:-rotate-1",
  },
  {
    id: "phase10",
    name: "Phase 10",
    tag: "Complete the phases",
    desc: "Clear all ten phases. Lowest score wins ties.",
    color: "var(--teal)",
    tilt: "hover:rotate-1",
  },
  {
    id: "spades",
    name: "Spades",
    tag: "Bid and take",
    desc: "Two teams, first to 500. Missed bids hurt!",
    color: "var(--plum)",
    tilt: "hover:-rotate-1",
  },
  {
    id: "uno",
    name: "UNO",
    tag: "Shed your hand",
    desc: "Round scores add up — first to 500 takes it.",
    color: "var(--coral)",
    tilt: "hover:rotate-1",
  },
  {
    id: "farkle",
    name: "Farkle",
    tag: "Risk the roll",
    desc: "Bank your dice and race to 10,000.",
    color: "var(--gold)",
    tilt: "hover:-rotate-1",
  },
  {
    id: "hearts",
    name: "Hearts",
    tag: "Duck the queen",
    desc: "Keep it low! The game ends at 100 points.",
    color: "oklch(0.55 0.17 25)",
    tilt: "hover:rotate-1",
  },
];

export function GamePicker({ onSelect, onJoin, onArchive }: Props) {
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [selectedGameForInstructions, setSelectedGameForInstructions] = useState<GameType | null>(null);

  const submitPin = () => {
    const p = pinInput.trim();
    if (!/^\d{4,6}$/.test(p)) {
      setPinError(true);
      return;
    }
    onJoin(p);
  };

  return (
    <div className="min-h-screen bg-paper flex justify-center px-5 py-10 sm:py-14">
      <div className="w-full max-w-xl fade-in">
        <header className="text-center mb-10">
          {/* The two-cards mark */}
          <div aria-hidden className="relative h-16 w-16 mx-auto mb-5">
            <div className="absolute left-0 top-0 h-11 w-11 rounded-xl border-4 border-gold bg-surface -rotate-12" />
            <div className="absolute left-5 top-3 h-11 w-11 rounded-xl border-4 border-teal bg-surface rotate-6" />
          </div>
          <div className="microcap mb-2">Game night · Live score sheet</div>
          <h1 className="font-display font-bold text-5xl sm:text-6xl tracking-tight leading-none mb-3">
            It&rsquo;s your turn!
          </h1>
          <p className="text-ink/65 text-[15px] leading-relaxed max-w-md mx-auto">
            Pick a game, rally the table, and watch every phone keep score together —
            live, hand by hand.
          </p>
        </header>

        {/* Join table — above games but below title */}
        <section className="mb-7 card-pop p-4.5 sm:p-5">
          <div className="microcap mb-3">Already have a table PIN?</div>
          <div className="flex items-center gap-2.5">
            <input
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6));
                setPinError(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && submitPin()}
              inputMode="numeric"
              placeholder="0000"
              aria-label="Table PIN"
              className={`w-30 font-mono font-semibold text-lg tracking-[0.3em] text-center bg-paper border-2 rounded-xl py-2.5 outline-none transition-colors placeholder:text-ink/25 focus:border-teal ${
                pinError ? "border-coral" : "border-line"
              }`}
            />
            <button onClick={submitPin} className="btn btn-accent px-5 py-2.5 text-sm">
              Join table
            </button>
          </div>
          {pinError && (
            <p className="mt-2 text-xs font-semibold text-coral">A table PIN is 4–6 digits.</p>
          )}
        </section>

        <section aria-label="Choose a game" className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {GAMES.map((g) => (
            <div
              key={g.id}
              className={`group card-pop p-4.5 sm:p-5 relative transition-transform duration-150 hover:-translate-y-1 ${g.tilt}`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedGameForInstructions(selectedGameForInstructions === g.id ? null : g.id);
                }}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-ink/5 hover:bg-ink/15 text-ink/60 hover:text-ink/85 transition-all"
                aria-label={`Instructions for ${g.name}`}
              >
                <HelpCircle size={20} />
              </button>

              {selectedGameForInstructions === g.id && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-3">
                  <div className="bg-surface rounded-xl border-2 border-line shadow-lg fade-in p-4 w-full">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span className="font-display font-bold text-lg leading-tight">
                        {g.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGameForInstructions(null);
                        }}
                        className="flex-shrink-0 text-ink/50 hover:text-ink/75 transition-colors mt-0.5"
                        aria-label="Close"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <p className="text-[13px] leading-relaxed text-ink/75">
                      {GAME_INSTRUCTIONS[g.id]}
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={() => onSelect(g.id)}
                className="w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ "--tw-ring-color": g.color } as React.CSSProperties}
              >
                <div
                  aria-hidden
                  className="h-9 w-9 rounded-lg border-[3px] bg-surface -rotate-6 group-hover:rotate-3 transition-transform mb-3"
                  style={{ borderColor: g.color }}
                />
                <div className="font-display font-bold text-2xl leading-tight mb-0.5">
                  {g.name}
                </div>
                <div
                  className="font-display font-bold text-[10px] tracking-[0.14em] uppercase mb-2"
                  style={{ color: g.color }}
                >
                  {g.tag}
                </div>
                <div className="text-[13px] text-ink/65 leading-snug">{g.desc}</div>
                <div
                  className="mt-3 flex items-center gap-1 font-display font-bold text-xs"
                  style={{ color: g.color }}
                >
                  Deal me in
                  <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            </div>
          ))}
        </section>

        <button
          onClick={() => onSelect("custom")}
          className="group card-pop mt-3.5 w-full p-4.5 sm:p-5 text-left flex items-center gap-4 transition-transform duration-150 hover:-translate-y-1"
        >
          <div
            aria-hidden
            className="shrink-0 h-9 w-9 rounded-lg border-[3px] border-dashed border-teal bg-surface -rotate-6 group-hover:rotate-3 transition-transform flex items-center justify-center font-display font-bold text-teal text-lg leading-none"
          >
            +
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-display font-bold text-xl leading-tight">Make your own</span>
            <span className="ml-2 font-display font-bold text-[10px] tracking-[0.14em] uppercase text-teal">
              Any game
            </span>
            <div className="text-[13px] text-ink/65 leading-snug">
              Name it, set a target, choose high or low wins — score anything.
            </div>
          </div>
          <ArrowRight
            size={16}
            className="shrink-0 text-teal group-hover:translate-x-0.5 transition-transform"
          />
        </button>

        <footer className="mt-10 flex flex-col items-center gap-3">
          <div aria-hidden className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-gold" />
            <span className="h-2 w-2 rounded-full bg-teal" />
            <span className="h-2 w-2 rounded-full bg-coral" />
          </div>
          <span className="text-xs text-ink/50 font-semibold">
            Scores sync live across every phone at the table.
          </span>
          <button
            onClick={onArchive}
            className="text-xs font-bold text-ink/55 underline underline-offset-4 decoration-2 decoration-line hover:text-teal hover:decoration-current transition-colors"
          >
            Past games
          </button>
        </footer>

      </div>
    </div>
  );
}
