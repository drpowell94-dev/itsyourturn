import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { CustomRules } from "@/lib/games";
import { GAME_LABELS, type GameType } from "@/lib/games";

type Props = {
  isCustom?: boolean;
  gameType?: GameType;
  onStart: (rules: (CustomRules & { target: number }) | { target: number }) => void;
  onBack: () => void;
};

// Setup for custom games or to configure standard game target score before creating
export function CustomSetup({ isCustom = true, gameType, onStart, onBack }: Props) {
  const [name, setName] = useState("");
  const [lowWins, setLowWins] = useState(false);
  const [targetDraft, setTargetDraft] = useState(isCustom ? "250" : "200");
  const [hasBust, setHasBust] = useState(false);
  const [bustDraft, setBustDraft] = useState("500");

  const target = targetDraft === "" ? 0 : parseInt(targetDraft, 10);
  const bust = hasBust && bustDraft !== "" ? parseInt(bustDraft, 10) : null;
  const canStart = target > 0 && (isCustom ? name.trim() || true : true);

  const start = () => {
    if (!canStart) return;
    if (isCustom) {
      onStart({ name: name.trim() || "Your Game", lowWins, target, bust });
    } else {
      onStart({ target });
    }
  };

  const gameTitle = isCustom ? "Your Game" : GAME_LABELS[gameType!];
  const heading = isCustom ? "Make it your own!" : `Ready to play ${gameTitle}?`;
  const description = isCustom
    ? "Any game with round scores works — name it, pick who wins, and deal."
    : `Set your target score to start the game.`;

  return (
    <div className="min-h-screen bg-paper flex justify-center px-5 py-10 sm:py-14">
      <div className="w-full max-w-md fade-in">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-bold text-ink/60 hover:text-teal transition-colors mb-8"
        >
          <ArrowLeft size={15} /> All games
        </button>

        <div className="microcap mb-2">{gameTitle} · Setup</div>
        <h1 className="font-display font-bold text-4xl tracking-tight mb-2">
          {heading}
        </h1>
        <p className="text-ink/65 text-[15px] leading-relaxed mb-7">
          {description}
        </p>

        <div className="card-pop p-5 space-y-5">
          {isCustom && (
            <>
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
            </>
          )}

          <label className="block">
            <span className="microcap block mb-1.5">{isCustom && lowWins ? "Game ends at" : "Play to"}</span>
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

          {isCustom && (
            <div className="pt-1">
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasBust}
                  onChange={(e) => setHasBust(e.target.checked)}
                  className="w-4 h-4 rounded border-2 border-line accent-accent"
                />
                <span className="microcap">Someone busts at</span>
              </label>
              {hasBust && (
                <input
                  value={bustDraft}
                  onChange={(e) =>
                    setBustDraft(
                      e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 5),
                    )
                  }
                  onFocus={(e) => {
                    const el = e.target;
                    requestAnimationFrame(() => el.select());
                  }}
                  onKeyDown={(e) => e.key === "Enter" && start()}
                  inputMode="numeric"
                  aria-label="Bust score"
                  className="w-32 font-mono font-semibold text-lg text-accent text-center bg-paper border-2 border-line rounded-xl px-3 py-2.5 outline-none focus:border-accent transition-colors"
                />
              )}
              <p className="mt-1.5 text-xs text-ink/50 font-semibold">
                The player who reaches this score loses and the game ends.
              </p>
            </div>
          )}

          <button onClick={start} disabled={!canStart} className="btn btn-accent w-full py-3 text-sm">
            {isCustom ? "Start scoring" : "Create game"}
          </button>
        </div>
      </div>
    </div>
  );
}
