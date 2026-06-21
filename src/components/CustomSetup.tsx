import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { GAME_LABELS, type GameType } from "@/lib/games";

type Props = {
  isCustom?: boolean;
  gameType?: GameType;
  onStart: (rules: any) => void;
  onBack: () => void;
};

// Setup for custom games or to configure standard game target score before creating
export function CustomSetup({ isCustom = true, gameType, onStart, onBack }: Props) {
  const [name, setName] = useState("");
  const [gameMode, setGameMode] = useState<"wins" | "loses" | "rounds">("wins");
  const [targetDraft, setTargetDraft] = useState("250");
  const [roundsDraft, setRoundsDraft] = useState("5");

  const target = targetDraft === "" ? 0 : parseInt(targetDraft, 10);
  const rounds = roundsDraft === "" ? 0 : parseInt(roundsDraft, 10);
  const canStart = isCustom ? name.trim() && (gameMode === "rounds" ? rounds > 0 : target > 0) : target > 0;

  const start = () => {
    if (!canStart) return;
    if (isCustom) {
      if (gameMode === "rounds") {
        onStart({ name: name.trim() || "Your Game", gameMode, rounds });
      } else {
        onStart({ name: name.trim() || "Your Game", gameMode, target });
      }
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
                <span className="microcap block mb-1.5">How does it end?</span>
                <div className="space-y-2">
                  <button
                    onClick={() => setGameMode("wins")}
                    className={`w-full py-2.5 rounded-xl border-2 font-display font-bold text-sm text-left px-3 transition-colors ${
                      gameMode === "wins"
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-line bg-paper text-ink/60 hover:border-accent/50"
                    }`}
                  >
                    First to score wins
                  </button>
                  <button
                    onClick={() => setGameMode("loses")}
                    className={`w-full py-2.5 rounded-xl border-2 font-display font-bold text-sm text-left px-3 transition-colors ${
                      gameMode === "loses"
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-line bg-paper text-ink/60 hover:border-accent/50"
                    }`}
                  >
                    First to score loses (busts)
                  </button>
                  <button
                    onClick={() => setGameMode("rounds")}
                    className={`w-full py-2.5 rounded-xl border-2 font-display font-bold text-sm text-left px-3 transition-colors ${
                      gameMode === "rounds"
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-line bg-paper text-ink/60 hover:border-accent/50"
                    }`}
                  >
                    Complete rounds, lowest wins
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-ink/50 font-semibold">
                  {gameMode === "wins"
                    ? "Like Hearts or Flip 7 — first to reach the number wins."
                    : gameMode === "loses"
                      ? "Like UNO — first to reach the number loses."
                      : "Like Phase 10 or Golf — play X rounds, lowest total wins."}
                </p>
              </div>
            </>
          )}

          {isCustom && gameMode !== "rounds" && (
            <label className="block">
              <span className="microcap block mb-1.5">
                {gameMode === "loses" ? "Bust at" : "Play to"}
              </span>
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
          )}

          {isCustom && gameMode === "rounds" && (
            <label className="block">
              <span className="microcap block mb-1.5">Play how many rounds?</span>
              <input
                value={roundsDraft}
                onChange={(e) =>
                  setRoundsDraft(
                    e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 2),
                  )
                }
                onFocus={(e) => {
                  const el = e.target;
                  requestAnimationFrame(() => el.select());
                }}
                onKeyDown={(e) => e.key === "Enter" && start()}
                inputMode="numeric"
                aria-label="Number of rounds"
                className="w-32 font-mono font-semibold text-lg text-accent text-center bg-paper border-2 border-line rounded-xl px-3 py-2.5 outline-none focus:border-accent transition-colors"
              />
            </label>
          )}

          {!isCustom && (
            <label className="block">
              <span className="microcap block mb-1.5">Play to</span>
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
          )}

          <button onClick={start} disabled={!canStart} className="btn btn-accent w-full py-3 text-sm">
            {isCustom ? "Start scoring" : "Create game"}
          </button>
        </div>
      </div>
    </div>
  );
}
