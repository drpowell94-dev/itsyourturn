import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Copy, Check, LogOut, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { saveGame } from "@/lib/history";
import {
  GAME_DEFAULT_TARGET,
  GAME_LABELS,
  isGameType,
  type CustomRules,
  type GameType,
} from "@/lib/games";
import { CALC_CONFIGS } from "@/lib/calculators";
import { GamePicker } from "@/components/GamePicker";
import { CustomSetup } from "@/components/CustomSetup";
import { HistoryView } from "@/components/HistoryView";
import { Flip7Board } from "@/components/games/Flip7Board";
import { Phase10Board } from "@/components/games/Phase10Board";
import { SpadesBoard } from "@/components/games/SpadesBoard";
import { RoundsBoard } from "@/components/games/RoundsBoard";

type Player = {
  id: string;
  initials: string;
  rounds: (number | null)[];
  phase?: number;
  bids?: (number | null)[];
  tricks?: (number | null)[];
  ownerId?: string | null;
};

function getDeviceId() {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("iyt_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("iyt_device_id", id);
  }
  return id;
}

export default function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [maxRound, setMaxRound] = useState(3);
  const [targetScore, setTargetScore] = useState(200);
  const [pin, setPin] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [gameType, setGameType] = useState<GameType | null>(null);
  const [customRules, setCustomRules] = useState<CustomRules | null>(null);
  const [showClaim, setShowClaim] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const deviceId = getDeviceId();
  const applyingRemote = useRef(false);
  const skipNextSave = useRef(true);
  const lastSyncedAt = useRef<string>("");
  const applyRef = useRef<(s: any, u?: string) => void>(() => {});
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const winnerSavedRef = useRef<string | null>(null);

  // Read pin from URL on mount.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("pin");
    if (p && !pin) setPin(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe + initial load when pin changes.
  useEffect(() => {
    if (!pin) return;
    let cancelled = false;
    const apply = (state: any, updatedAt?: string) => {
      if (!state || cancelled) return;
      if (updatedAt && lastSyncedAt.current && updatedAt < lastSyncedAt.current) return;
      if (updatedAt) lastSyncedAt.current = updatedAt;
      applyingRemote.current = true;
      skipNextSave.current = true;
      setPlayers(state.players ?? []);
      setTargetScore(state.targetScore ?? 200);
      setMaxRound(state.maxRound ?? 3);
      setHostId(state.hostId ?? null);
      setCustomRules(state.customRules ?? null);
      if (isGameType(state.gameType)) setGameType(state.gameType);
      setTimeout(() => (applyingRemote.current = false), 0);
    };
    applyRef.current = apply;
    const channel = supabase
      .channel(`game-${pin}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `pin=eq.${pin}` },
        (payload: any) => {
          apply(payload.new?.state, payload.new?.updated_at);
        },
      )
      .subscribe();
    supabase
      .from("games")
      .select("state, updated_at, game_type")
      .eq("pin", pin)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.state) {
          const s: any = data.state;
          // Fallback: read game_type from column if missing from state.
          if (!isGameType(s.gameType) && isGameType((data as any).game_type)) {
            s.gameType = (data as any).game_type;
          }
          apply(s, data.updated_at as string);
          const host = s.hostId && s.hostId === deviceId;
          const owns = (s.players ?? []).some((p: any) => p.ownerId === deviceId);
          if (!host && !owns) setShowClaim(true);
        }
      });
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [pin, deviceId]);

  // Debounced push with optimistic concurrency (CAS on updated_at).
  useEffect(() => {
    if (!pin || !gameType) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (applyingRemote.current) return;
    const t = setTimeout(async () => {
      const updated_at = new Date().toISOString();
      const prev = lastSyncedAt.current;
      let q = supabase
        .from("games")
        .update({
          state: { players, targetScore, maxRound, hostId, gameType, customRules },
          game_type: gameType,
          updated_at,
        })
        .eq("pin", pin);
      if (prev) q = q.eq("updated_at", prev);
      const { data, error } = await q.select("updated_at");
      if (!error && data && data.length > 0) {
        lastSyncedAt.current = updated_at;
      } else if (!error) {
        const { data: latest } = await supabase
          .from("games")
          .select("state, updated_at")
          .eq("pin", pin)
          .maybeSingle();
        if (latest?.state) applyRef.current(latest.state, latest.updated_at as string);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [players, targetScore, maxRound, pin, hostId, gameType, customRules]);

  const handleSelectGameType = (type: GameType) => {
    setGameType(type);
    setTargetScore(GAME_DEFAULT_TARGET[type]);
    // Auto-host: generate a PIN immediately so multiplayer is always ready
    // (Custom games will host after setup completes)
    if (type !== "custom") {
      setTimeout(() => createGame(type), 0);
    }
  };

  const createGame = async (type: GameType) => {
    // Custom games keep whatever target the host chose in setup.
    const initialTarget = type === "custom" ? targetScore : GAME_DEFAULT_TARGET[type];
    for (let attempt = 0; attempt < 5; attempt++) {
      const newPin = Math.floor(1000 + Math.random() * 9000).toString();
      const { data, error } = await supabase
        .from("games")
        .insert({
          pin: newPin,
          game_type: type,
          state: {
            players: [],
            targetScore: initialTarget,
            maxRound: 3,
            hostId: deviceId,
            gameType: type,
            customRules,
          },
        })
        .select("updated_at")
        .single();
      if (!error) {
        skipNextSave.current = true;
        lastSyncedAt.current = (data?.updated_at as string) || "";
        sessionIdRef.current = crypto.randomUUID();
        setPlayers([]);
        setTargetScore(initialTarget);
        setMaxRound(3);
        setHostId(deviceId);
        setGameType(type);
        window.history.replaceState(null, "", `?pin=${newPin}`);
        setPin(newPin);
        return;
      }
      if ((error as any).code !== "23505") break;
    }
    setCreateError(true);
  };

  const joinGame = (p: string) => {
    window.history.replaceState(null, "", `?pin=${p}`);
    setShowArchive(false);
    setPin(p);
  };

  const leaveGame = () => {
    setPin(null);
    setHostId(null);
    setShowClaim(false);
    setGameType(null);
    setCustomRules(null);
    window.history.replaceState(null, "", window.location.pathname);
    skipNextSave.current = true;
    setPlayers([]);
    setMaxRound(3);
  };

  const backToPicker = () => {
    setGameType(null);
    setCustomRules(null);
    setPlayers([]);
    setMaxRound(3);
    setTargetScore(200);
    sessionIdRef.current = crypto.randomUUID();
    winnerSavedRef.current = null;
  };

  const isHost = Boolean(!pin || (hostId && hostId === deviceId));
  const canEdit = (pl: Player) => !pin || isHost || pl.ownerId === deviceId;

  const claimPlayer = (id: string) => {
    setPlayers((p) => p.map((x) => (x.id === id ? { ...x, ownerId: deviceId } : x)));
    setShowClaim(false);
  };

  const addPlayerFromClaim = () => {
    if (!newPlayerName.trim()) return;
    setPlayers((p) => [
      ...p,
      {
        id: crypto.randomUUID(),
        initials: newPlayerName.trim().toUpperCase().slice(0, 3),
        rounds: Array(maxRound).fill(null),
        phase: gameType === "phase10" ? 1 : undefined,
        ownerId: pin ? deviceId : null,
      },
    ]);
    setNewPlayerName("");
    if (pin) setShowClaim(false);
  };

  const handleNewGame = () => {
    // Boards persist via onWinner; manual new-game resets just clear local
    // state (history already includes prior wins).
    sessionIdRef.current = crypto.randomUUID();
    winnerSavedRef.current = null;
    setPlayers([]);
    setMaxRound(3);
  };

  const handleWinner = (
    winnerInitials: string | null,
    playersPayload: { initials: string; total: number; rounds: (number | null)[] }[],
  ) => {
    if (!gameType) return;
    if (winnerInitials && winnerSavedRef.current === winnerInitials) return;
    if (winnerInitials) winnerSavedRef.current = winnerInitials;
    saveGame({
      sessionId: sessionIdRef.current,
      targetScore,
      players: playersPayload,
      winner: winnerInitials,
    });
    if (pin) {
      const completed_at = new Date().toISOString();
      supabase
        .from("game_history")
        .upsert(
          {
            pin,
            session_id: sessionIdRef.current,
            winner: winnerInitials,
            target_score: targetScore,
            players: playersPayload,
            game_type: gameType,
            completed_at,
          },
          { onConflict: "pin,session_id" },
        )
        .then(() => {});
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — the PIN is visible anyway */
    }
  };

  // ── Archive (past games) ────────────────────────────────────────────
  if (showArchive) {
    return (
      <div
        data-game={gameType ?? undefined}
        className="min-h-screen bg-paper flex justify-center px-5 py-10 sm:py-14"
      >
        <div className="w-full max-w-xl fade-in">
          <button
            onClick={() => setShowArchive(false)}
            className="flex items-center gap-1.5 text-sm text-ink/60 hover:text-accent transition-colors mb-8"
          >
            <ArrowLeft size={15} /> Back to the table
          </button>
          <div className="microcap mb-3">
            {pin ? `Tonight · Table ${pin}` : "On this device"}
          </div>
          <h1 className="font-display font-bold text-4xl tracking-tight mb-8">Past games</h1>
          <HistoryView sessionId={pin ?? undefined} showClear={!pin} />
        </div>
      </div>
    );
  }

  // ── Landing: pick a game ────────────────────────────────────────────
  if (!pin && !gameType) {
    return (
      <GamePicker
        onSelect={handleSelectGameType}
        onJoin={joinGame}
        onArchive={() => setShowArchive(true)}
      />
    );
  }

  // ── Joining: waiting for the table to load ──────────────────────────
  if (pin && (!gameType || (gameType === "custom" && !customRules))) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-5">
        <p className="font-display font-semibold text-xl text-ink/55 fade-in">
          Pulling up a chair at table {pin}…
        </p>
      </div>
    );
  }

  // ── Custom game: name it and pick the rules before the board ────────
  if (gameType === "custom" && !customRules) {
    return (
      <CustomSetup
        onBack={backToPicker}
        onStart={({ name, lowWins, target }) => {
          setCustomRules({ name, lowWins });
          setTargetScore(target);
          // Auto-host after custom game setup
          setTimeout(() => createGame("custom"), 0);
        }}
      />
    );
  }

  const title =
    gameType === "custom" ? customRules?.name || "Your Game" : GAME_LABELS[gameType!];

  // ── The table ───────────────────────────────────────────────────────
  return (
    <div
      data-game={gameType ?? undefined}
      className="min-h-screen bg-paper flex justify-center px-3 sm:px-5 py-6 sm:py-10"
    >
      <div className="w-full max-w-2xl fade-in">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-6 sm:mb-8">
          <div>
            <div className="microcap mb-1.5">
              It&rsquo;s your turn · <span className="text-accent">{title}</span>
            </div>
            <h1 className="font-display font-bold text-4xl sm:text-[44px] leading-none tracking-tight">
              {title}
            </h1>
            {!pin && (
              <button
                onClick={backToPicker}
                className="mt-2 flex items-center gap-1 text-xs text-ink/55 hover:text-accent transition-colors"
              >
                <ArrowLeft size={12} /> Change game
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pin ? (
              <div className="flex items-center gap-2 border-2 border-line bg-surface rounded-xl px-3 py-2">
                <span className="microcap">Table</span>
                <span className="font-mono font-semibold tracking-[0.2em] text-sm text-accent">
                  {pin}
                </span>
                <button
                  onClick={copyInvite}
                  aria-label="Copy invite link"
                  className="text-ink/40 hover:text-accent transition-colors"
                >
                  {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
                </button>
                <span className="w-px h-4 bg-line" />
                <button
                  onClick={leaveGame}
                  aria-label="Leave table"
                  className="text-ink/40 hover:text-coral transition-colors"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : null}
            <button
              onClick={() => setShowArchive(true)}
              className="btn btn-white px-3.5 py-2 text-sm"
            >
              Tonight
            </button>
          </div>
        </header>

        {createError && (
          <p className="-mt-2 mb-5 text-sm font-semibold text-coral">
            Couldn&rsquo;t create a table just now — try again in a moment.
          </p>
        )}

        {gameType === "flip7" ? (
          <Flip7Board
            players={players}
            setPlayers={setPlayers as any}
            maxRound={maxRound}
            setMaxRound={setMaxRound}
            targetScore={targetScore}
            setTargetScore={setTargetScore}
            canEdit={canEdit}
            ownerIdForNew={pin ? deviceId : null}
            onWinner={handleWinner}
            onNewGame={handleNewGame}
          />
        ) : gameType === "phase10" ? (
          <Phase10Board
            players={players}
            setPlayers={setPlayers as any}
            maxRound={maxRound}
            setMaxRound={setMaxRound}
            canEdit={canEdit}
            ownerIdForNew={pin ? deviceId : null}
            onWinner={handleWinner}
            onNewGame={handleNewGame}
          />
        ) : gameType === "spades" ? (
          <SpadesBoard
            players={players}
            setPlayers={setPlayers as any}
            maxRound={maxRound}
            setMaxRound={setMaxRound}
            targetScore={targetScore}
            setTargetScore={setTargetScore}
            canEdit={canEdit}
            ownerIdForNew={pin ? deviceId : null}
            onWinner={handleWinner}
            onNewGame={handleNewGame}
          />
        ) : (
          <RoundsBoard
            players={players}
            setPlayers={setPlayers as any}
            maxRound={maxRound}
            setMaxRound={setMaxRound}
            targetScore={targetScore}
            setTargetScore={setTargetScore}
            lowWins={gameType === "hearts" || (gameType === "custom" && !!customRules?.lowWins)}
            calcConfig={CALC_CONFIGS[gameType!]}
            canEdit={canEdit}
            ownerIdForNew={pin ? deviceId : null}
            onWinner={handleWinner}
            onNewGame={handleNewGame}
            gameType={gameType ?? undefined}
          />
        )}
      </div>

      {/* Claim a seat */}
      {showClaim && pin && (
        <div className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface rounded-2xl border-2 border-ink shadow-[0_4px_0_var(--ink)] p-5 fade-in">
            <div className="microcap mb-1">
              Table {pin} · {title}
            </div>
            <h2 className="font-display font-bold text-2xl mb-4">Who are you tonight?</h2>
            {players.length === 0 ? (
              <p className="text-sm text-ink/60 mb-4">
                No one at the table yet — add yourself below.
              </p>
            ) : (
              <div className="border-t border-line mb-4 max-h-60 overflow-y-auto">
                {players.map((p) => {
                  const taken = !!p.ownerId && p.ownerId !== deviceId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => !taken && claimPlayer(p.id)}
                      disabled={taken}
                      className="w-full flex items-center justify-between py-2.5 border-b border-line disabled:opacity-35 hover:text-accent transition-colors text-left"
                    >
                      <span className="font-mono font-semibold tracking-[0.15em] text-sm">
                        {p.initials || "???"}
                      </span>
                      <span className="microcap">{taken ? "Taken" : "That's me"}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-ink/60 mb-1.5">
                Your name
              </label>
              <input
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value.toUpperCase().slice(0, 3))}
                onKeyDown={(e) => e.key === "Enter" && addPlayerFromClaim()}
                placeholder="ABC"
                maxLength={3}
                aria-label="Enter your name (initials)"
                className="w-full font-mono font-semibold text-center text-sm bg-paper border-2 border-line rounded-lg focus:border-accent outline-none px-3 py-2 transition-colors"
              />
            </div>
            <button
              onClick={addPlayerFromClaim}
              disabled={!newPlayerName.trim()}
              className="btn btn-accent w-full py-2.5 text-sm flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <Plus size={15} /> Join
            </button>
            <button
              onClick={() => setShowClaim(false)}
              className="w-full mt-2.5 text-xs text-ink/50 underline underline-offset-4 decoration-line hover:text-accent hover:decoration-current transition-colors"
            >
              Just watching
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
