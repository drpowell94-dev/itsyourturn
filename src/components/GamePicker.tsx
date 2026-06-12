import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { GameType } from "@/lib/games";

type Props = {
  onSelect: (type: GameType) => void;
  onJoin: (pin: string) => void;
  onArchive: () => void;
};

const GAMES: { id: GameType; index: string; name: string; tag: string; desc: string }[] = [
  {
    id: "flip7",
    index: "01",
    name: "Flip 7",
    tag: "Press your luck",
    desc: "First to 200. Bust if you flip a duplicate.",
  },
  {
    id: "phase10",
    index: "02",
    name: "Phase 10",
    tag: "Complete the phases",
    desc: "Clear all ten phases. Lowest score wins ties.",
  },
  {
    id: "spades",
    index: "03",
    name: "Spades",
    tag: "Bid and take",
    desc: "Two teams, first to 500. Missed bids hurt.",
  },
];

export function GamePicker({ onSelect, onJoin, onArchive }: Props) {
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  const submitPin = () => {
    const p = pinInput.trim();
    if (!/^\d{4,6}$/.test(p)) {
      setPinError(true);
      return;
    }
    onJoin(p);
  };

  return (
    <div className="min-h-screen bg-paper flex justify-center px-5 py-10 sm:py-16">
      <div className="w-full max-w-xl fade-in">
        <header className="mb-10 sm:mb-14">
          <div className="microcap mb-4">Game night · Shared score sheet</div>
          <h1 className="font-display italic text-5xl sm:text-6xl tracking-tight leading-none mb-4">
            It&rsquo;s your turn.
          </h1>
          <p className="text-ink/65 text-[15px] leading-relaxed max-w-md">
            A quiet scorekeeper for the table. Pick a game, host it, and everyone&rsquo;s
            phone follows along on one shared sheet.
          </p>
        </header>

        <section aria-label="Choose a game" className="border-t border-line">
          {GAMES.map((g) => (
            <button
              key={g.id}
              onClick={() => onSelect(g.id)}
              className="group w-full grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-3 py-5 border-b border-line text-left transition-colors hover:bg-surface focus-visible:bg-surface outline-none"
            >
              <span className="font-mono text-xs text-ink/35 group-hover:text-accent transition-colors">
                {g.index}
              </span>
              <span>
                <span className="block font-display text-2xl sm:text-[28px] leading-tight">
                  {g.name}
                </span>
                <span className="block text-[13px] text-ink/55 mt-1">
                  <span className="text-ink/80">{g.tag}.</span> {g.desc}
                </span>
              </span>
              <ArrowRight
                size={16}
                className="self-center text-ink/25 group-hover:text-accent group-hover:translate-x-0.5 transition-all"
              />
            </button>
          ))}
        </section>

        <section className="mt-10">
          <div className="microcap mb-3">Joining someone&rsquo;s table?</div>
          <div className="flex items-center gap-2">
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
              className={`w-28 font-mono text-lg tracking-[0.3em] text-center bg-surface border rounded-lg py-2.5 outline-none transition-colors placeholder:text-ink/25 focus:border-accent ${
                pinError ? "border-red-700/60" : "border-line"
              }`}
            />
            <button
              onClick={submitPin}
              className="px-4 py-2.5 rounded-lg border border-line bg-surface text-sm text-ink/80 hover:border-accent hover:text-accent transition-colors"
            >
              Join table
            </button>
          </div>
          {pinError && (
            <p className="mt-2 text-xs text-red-800/80">A table PIN is 4–6 digits.</p>
          )}
        </section>

        <footer className="mt-12 pt-5 border-t border-line flex items-center justify-between">
          <span className="text-xs text-ink/45">
            Scores sync live across every phone at the table.
          </span>
          <button
            onClick={onArchive}
            className="text-xs text-ink/55 underline underline-offset-4 decoration-line hover:text-accent hover:decoration-current transition-colors"
          >
            Past games
          </button>
        </footer>
      </div>
    </div>
  );
}
