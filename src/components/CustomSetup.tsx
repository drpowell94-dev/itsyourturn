import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { CustomRules } from "@/lib/games";

type Props = {
  onStart: (rules: CustomRules & { target: number }) => void;
  onBack: () => void;
};

// Setup for the "Your Game" mode: name anything, pick who wins, set the
// number that ends it. Everything else reuses the shared rounds board.
export function CustomSetup({ onStart, onBack }: Props) {
  const [name, setName] = useState("");
  const [lowWins, setLowWins] = useState(false);
  const [targetDraft, setTargetDraft] = useState("250");

  const target = targetDraft === "" ? 0 : parseInt(targetDraft, 10);
  const canStart = target > 0;

  const start = () => {
    if (!canStart) return;
    onStart({ name: name.trim() || "Your Game", lowWins, target });
  };

  return (
    <div className="min-h-screen bg-paper flex justify-center px-5 py-10 sm:py-14">
      <div className="w-full max-w-md fade-in">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-bold text-ink/60 hover:text-teal transition-colors mb-8"
        >
          <ArrowLeft size={15} /> All games
        </button>

        <div className="microcap mb-2">Your game · Setup</div>
        <h1 className="font-display font-bold text-4xl tracking-tight mb-2">
          Make it your own!
        </h1>
        <p className="text-ink/65 text-[15px] leading-relaxed mb-7">
          Any game with round scores works — name it, pick who wins, and deal.
        </p>

        <div className="card-pop p-5 space-y-5">
          <label className="block">
            <span className="microcap block mb-1.5">What are we playing?</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              onKeyDown={(e) => e.key === "Enter" && start()}
              placeholder="Rummy, Golf, Left Right Center…"
              className="w-full font-display font-bold text-lg text-ink bg-paper border-2 border-line rounded-xl px-3 py-2.5 outline-none focus:border-accent placeholder:text-ink/30 placeholder:font-semibold transition-colors"
            />
          </label>

          <div>
            <span className="microcap block mb-1.5">Who wins?</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setLowWins(false)}
                className={`py-2.5 rounded-xl border-2 font-display font-bold text-sm transition-colors ${
                  !lowWins
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-paper text-ink/60 hover:border-accent/50"
                }`}
              >
                Highest score
              </button>
              <button
                onClick={() => setLowWins(true)}
                className={`py-2.5 rounded-xl border-2 font-display font-bold text-sm transition-colors ${
                  lowWins
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-paper text-ink/60 hover:border-accent/50"
                }`}
              >
                Lowest score
              </button>
            </div>
            <p className="mt-1.5 text-xs text-ink/50 font-semibold">
              {lowWins
                ? "The game ends when anyone reaches the number — lowest total wins."
                : "First to reach the number takes the game."}
            </p>
          </div>

          <label className="block">
            <span className="microcap block mb-1.5">{lowWins ? "Game ends at" : "Play to"}</span>
            <input
              value={targetDraft}
              onChange={(e) =>
                setTargetDraft(
                  e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 5),
                )
              }
              onFocus={(e) => {
                const el = e.target;
                requestAnimationFrame(() => el.select());
              }}
              onKeyDown={(e) => e.key === "Enter" && start()}
              inputMode="numeric"
              aria-label="Target score"
              className="w-32 font-mono font-semibold text-lg text-accent text-center bg-paper border-2 border-line rounded-xl px-3 py-2.5 outline-none focus:border-accent transition-colors"
            />
          </label>

          <button onClick={start} disabled={!canStart} className="btn btn-accent w-full py-3 text-sm">
            Start scoring
          </button>
        </div>
      </div>
    </div>
  );
}
