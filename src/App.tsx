import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Copy, Check, LogOut, Plus } from "lucide-react";
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
import { TargetInput } from "@/components/TargetInput";
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

// Everything except id and ownerId — what gets stored in game_players.state.
function playerToRowState(player: Player) {
  const { id: _id, ownerId: _ownerId, ...state } = player;
  return state;
}

// Reconstruct a Player from a game_players row.
function rowToPlayer(row: any): Player {
  return { id: row.player_id, ownerId: row.owner_id ?? null, ...row.state };
}

export default function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [maxRound, setMaxRound] = useState(1);
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
  const [joinInput, setJoinInput] = useState("");
  const [pendingType, setPendingType] = useState<GameType | null>(null);
  const [pendingTarget, setPendingTarget] = useState(200);
  const deviceId = getDeviceId();
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const gameLoadedRef = useRef(false);
  const winnerSavedRef = useRef<string | null>(null);

  // Session-level sync state (games table).
  const applyRef = useRef<(s: any, u?: string) => void>(() => {});
  const lastSyncedAt = useRef<string>("");
  const skipNextSessionSave = useRef(true);

  // Per-player sync state (game_players table).
  // Each map is keyed by player_id and tracks what we last successfully
  // pushed to the server. The push effect compares current local state
  // against these snapshots to find what changed.
  const rowUpdatedAt = useRef<Map<string, string>>(new Map());       // CAS token per row
  const rowStateSent = useRef<Map<string, string>>(new Map());       // JSON of last-pushed state
  const rowOwnerSent = useRef<Map<string, string | null>>(new Map()); // last-pushed owner_id
  const rowSeq = useRef<Map<string, number>>(new Map());             // insertion order

  const isHost = Boolean(!pin || (hostId && hostId === deviceId));

  // Read pin from URL on mount.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("pin");
    if (p && !pin) setPin(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to games (session fields) + game_players (per-player rows).
  useEffect(() => {
    if (!pin) return;
    let cancelled = false;
    gameLoadedRef.current = false;

    // Apply session-level state from the games row.
    const applySession = (s: any, updatedAt?: string) => {
      if (!s || cancelled) return;
      if (updatedAt && lastSyncedAt.current && updatedAt < lastSyncedAt.current) return;
      if (updatedAt) lastSyncedAt.current = updatedAt;
      skipNextSessionSave.current = true;
      setTargetScore(s.targetScore ?? 200);
      setMaxRound(s.maxRound ?? 3);
      setHostId(s.hostId ?? null);
      setCustomRules(s.customRules ?? null);
      if (isGameType(s.gameType)) setGameType(s.gameType);
      if (s.sessionId) setSessionId(s.sessionId);
    };
    applyRef.current = applySession;

    // Apply a single incoming player row (INSERT or UPDATE).
    // We update the tracking refs BEFORE calling setPlayers so that the
    // player push effect sees "no change" for this player and skips it.
    const applyRow = (row: any) => {
      if (cancelled) return;
      rowUpdatedAt.current.set(row.player_id, row.updated_at);
      rowStateSent.current.set(row.player_id, JSON.stringify(row.state));
      rowOwnerSent.current.set(row.player_id, row.owner_id ?? null);
      if (row.seq) rowSeq.current.set(row.player_id, row.seq);
      setPlayers(prev => {
        const idx = prev.findIndex(p => p.id === row.player_id);
        const player = rowToPlayer(row);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = player;
          return next;
        }
        // New player from another device — insert in seq order.
        return [...prev, player].sort(
          (a, b) => (rowSeq.current.get(a.id) ?? 0) - (rowSeq.current.get(b.id) ?? 0),
        );
      });
    };

    const removeRow = (playerId: string) => {
      if (cancelled) return;
      rowUpdatedAt.current.delete(playerId);
      rowStateSent.current.delete(playerId);
      rowOwnerSent.current.delete(playerId);
      rowSeq.current.delete(playerId);
      setPlayers(prev => prev.filter(p => p.id !== playerId));
    };

    // Subscribe to session-level changes.
    const gameCh = supabase
      .channel(`game-${pin}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `pin=eq.${pin}` },
        (payload: any) => applySession(payload.new?.state, payload.new?.updated_at),
      )
      .subscribe();

    // Subscribe to per-player row changes.
    const playerCh = supabase
      .channel(`players-${pin}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_players", filter: `pin=eq.${pin}` },
        (payload: any) => {
          rowSeq.current.set(payload.new.player_id, payload.new.seq);
          applyRow(payload.new);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_players", filter: `pin=eq.${pin}` },
        (payload: any) => applyRow(payload.new),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "game_players", filter: `pin=eq.${pin}` },
        (payload: any) => {
          if (payload.old?.player_id) removeRow(payload.old.player_id);
        },
      )
      .subscribe();

    // Initial load — fetch session and player rows in parallel.
    Promise.all([
      supabase.from("games").select("state, updated_at, game_type").eq("pin", pin).maybeSingle(),
      supabase.from("game_players").select("*").eq("pin", pin).order("seq"),
    ]).then(([{ data: gameData }, { data: playerData }]) => {
      if (cancelled) return;

      if (gameData?.state) {
        const s: any = gameData.state;
        // Fallback: read game_type from the column if missing from state blob.
        if (!isGameType(s.gameType) && isGameType((gameData as any).game_type))
          s.gameType = (gameData as any).game_type;
        applySession(s, gameData.updated_at as string);
      }

      if (playerData?.length) {
        playerData.forEach(row => {
          rowUpdatedAt.current.set(row.player_id, row.updated_at);
          rowStateSent.current.set(row.player_id, JSON.stringify(row.state));
          rowOwnerSent.current.set(row.player_id, row.owner_id ?? null);
          rowSeq.current.set(row.player_id, row.seq);
        });
        setPlayers(playerData.map(rowToPlayer));
      }

      // Prompt guests who haven't claimed a seat yet.
      const isHostDevice = gameData?.state?.hostId === deviceId;
      const ownsASeat = (playerData ?? []).some(r => r.owner_id === deviceId);
      if (!isHostDevice && !ownsASeat) setShowClaim(true);

      gameLoadedRef.current = true;
    });

    return () => {
      cancelled = true;
      gameLoadedRef.current = false;
      supabase.removeChannel(gameCh);
      supabase.removeChannel(playerCh);
    };
  }, [pin, deviceId]);

  // Debounced push for session-level fields → games table.
  // Player data is no longer in this payload; only targetScore, maxRound, etc.
  useEffect(() => {
    if (!pin || !gameType) return;
    if (skipNextSessionSave.current) {
      skipNextSessionSave.current = false;
      return;
    }
    const t = setTimeout(async () => {
      const updated_at = new Date().toISOString();
      const prev = lastSyncedAt.current;
      let q = supabase
        .from("games")
        .update({
          state: { targetScore, maxRound, hostId, gameType, customRules, sessionId },
          game_type: gameType,
          updated_at,
        })
        .eq("pin", pin);
      if (prev) q = q.eq("updated_at", prev);
      const { data, error } = await q.select("updated_at");
      if (!error && data?.length) {
        lastSyncedAt.current = updated_at;
      } else if (!error) {
        // Lost the CAS race — apply the winner's state.
        const { data: latest } = await supabase
          .from("games")
          .select("state, updated_at")
          .eq("pin", pin)
          .maybeSingle();
        if (latest?.state) applyRef.current(latest.state, latest.updated_at as string);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [targetScore, maxRound, pin, hostId, gameType, customRules, sessionId]);

  // Debounced push for player data → game_players table (one row per player).
  // Each device only writes rows it has permission to write.
  // Since rows are independent, two players editing simultaneously never conflict.
  useEffect(() => {
    if (!pin) return;
    const t = setTimeout(async () => {
      const currentIds = new Set(players.map(p => p.id));

      // Insertions and updates.
      for (const player of players) {
        const canWrite = isHost || player.ownerId === deviceId;
        if (!canWrite) continue;

        const stateJson = JSON.stringify(playerToRowState(player));
        const prevJson = rowStateSent.current.get(player.id);
        const existingUpdatedAt = rowUpdatedAt.current.get(player.id);
        const ownerChanged = (player.ownerId ?? null) !== (rowOwnerSent.current.get(player.id) ?? null);

        if (existingUpdatedAt === undefined) {
          // New player — INSERT.
          const { data, error } = await supabase
            .from("game_players")
            .insert({
              pin,
              player_id: player.id,
              owner_id: player.ownerId ?? null,
              state: playerToRowState(player),
            })
            .select("updated_at, seq")
            .maybeSingle();
          if (!error && data) {
            rowUpdatedAt.current.set(player.id, data.updated_at);
            rowStateSent.current.set(player.id, stateJson);
            rowOwnerSent.current.set(player.id, player.ownerId ?? null);
            rowSeq.current.set(player.id, data.seq);
          } else if ((error as any)?.code === "23505") {
            // Row already exists (rare race) — fetch and apply remote.
            const { data: existing } = await supabase
              .from("game_players")
              .select("*")
              .eq("pin", pin)
              .eq("player_id", player.id)
              .maybeSingle();
            if (existing) {
              rowUpdatedAt.current.set(existing.player_id, existing.updated_at);
              rowStateSent.current.set(existing.player_id, JSON.stringify(existing.state));
              rowOwnerSent.current.set(existing.player_id, existing.owner_id ?? null);
              rowSeq.current.set(existing.player_id, existing.seq);
              setPlayers(prev => prev.map(p => p.id === player.id ? rowToPlayer(existing) : p));
            }
          }
        } else if (stateJson !== prevJson || ownerChanged) {
          // Changed player — UPDATE with per-row CAS on updated_at.
          const newUpdatedAt = new Date().toISOString();
          let q = supabase
            .from("game_players")
            .update({
              state: playerToRowState(player),
              owner_id: player.ownerId ?? null,
              updated_at: newUpdatedAt,
            })
            .eq("pin", pin)
            .eq("player_id", player.id);
          if (existingUpdatedAt) q = q.eq("updated_at", existingUpdatedAt);
          const { data, error } = await q.select("updated_at");
          if (!error && data?.length) {
            rowUpdatedAt.current.set(player.id, newUpdatedAt);
            rowStateSent.current.set(player.id, stateJson);
            rowOwnerSent.current.set(player.id, player.ownerId ?? null);
          } else if (!error) {
            // Lost the CAS race — fetch the winner's row and apply it locally.
            const { data: latest } = await supabase
              .from("game_players")
              .select("*")
              .eq("pin", pin)
              .eq("player_id", player.id)
              .maybeSingle();
            if (latest) {
              rowUpdatedAt.current.set(latest.player_id, latest.updated_at);
              rowStateSent.current.set(latest.player_id, JSON.stringify(latest.state));
              rowOwnerSent.current.set(latest.player_id, latest.owner_id ?? null);
              setPlayers(prev =>
                prev.map(p => p.id === latest.player_id ? rowToPlayer(latest) : p),
              );
            }
          }
        }
      }

      // Deletions — rows we were tracking that are no longer in the players array.
      for (const [pid] of rowUpdatedAt.current) {
        if (currentIds.has(pid)) continue;
        const wasOwner = rowOwnerSent.current.get(pid);
        if (!isHost && wasOwner !== deviceId) continue;
        await supabase.from("game_players").delete().eq("pin", pin).eq("player_id", pid);
        rowUpdatedAt.current.delete(pid);
        rowStateSent.current.delete(pid);
        rowOwnerSent.current.delete(pid);
        rowSeq.current.delete(pid);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [players, pin, isHost, deviceId]);

  const handleSelectGameType = (type: GameType) => {
    if (type === "custom") {
      setGameType(type);
      Promise.resolve().then(() => createGame(type, GAME_DEFAULT_TARGET[type]));
    } else {
      setPendingType(type);
      setPendingTarget(GAME_DEFAULT_TARGET[type]);
    }
  };

  const startGame = (type: GameType, target: number) => {
    setPendingType(null);
    setGameType(type);
    setTargetScore(target);
    setCreateError(false);
    Promise.resolve().then(() => createGame(type, target));
  };

  const createGame = async (type: GameType, target?: number) => {
    const initialTarget = target ?? targetScore;
    const newSessionId = crypto.randomUUID();
    for (let attempt = 0; attempt < 5; attempt++) {
      const newPin = Math.floor(1000 + Math.random() * 9000).toString();
      const { data, error } = await supabase
        .from("games")
        .insert({
          pin: newPin,
          game_type: type,
          state: {
            targetScore: initialTarget,
            maxRound: 3,
            hostId: deviceId,
            gameType: type,
            customRules,
            sessionId: newSessionId,
          },
        })
        .select("updated_at")
        .single();
      if (!error) {
        skipNextSessionSave.current = true;
        lastSyncedAt.current = (data?.updated_at as string) || "";
        setSessionId(newSessionId);
        setPlayers([]);
        setTargetScore(initialTarget);
        setMaxRound(1);
        setHostId(deviceId);
        setGameType(type);
        window.history.replaceState(null, "", `?pin=${newPin}`);
        setPin(newPin);
        return;
      }
      console.error("createGame error:", error);
      if ((error as any).code !== "23505") break;
    }
    if (type !== "custom") {
      setGameType(null);
      setPendingType(type);
    }
    setCreateError(true);
  };

  const joinGame = (p: string) => {
    window.history.replaceState(null, "", `?pin=${p}`);
    setShowArchive(false);
    setJoinInput("");
    setPin(p);
  };

  const leaveGame = () => {
    setPin(null);
    setHostId(null);
    setShowClaim(false);
    setGameType(null);
    setCustomRules(null);
    window.history.replaceState(null, "", window.location.pathname);
    skipNextSessionSave.current = true;
    lastSyncedAt.current = "";
    setPlayers([]);
    setMaxRound(3);
    rowUpdatedAt.current.clear();
    rowStateSent.current.clear();
    rowOwnerSent.current.clear();
    rowSeq.current.clear();
    winnerSavedRef.current = null;
    gameLoadedRef.current = false;
  };

  const backToPicker = () => {
    setPendingType(null);
    setGameType(null);
    setCustomRules(null);
    setPlayers([]);
    setMaxRound(3);
    setTargetScore(200);
    setCreateError(false);
    setSessionId(crypto.randomUUID());
    winnerSavedRef.current = null;
  };

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
    setSessionId(crypto.randomUUID());
    winnerSavedRef.current = null;
    setPlayers([]);
    setMaxRound(3);
  };

  const handleWinner = useCallback((
    winnerInitials: string | null,
    playersPayload: { initials: string; total: number; rounds: (number | null)[] }[],
  ) => {
    if (!gameType) return;
    if (pin && !isHost) return;
    if (pin && !gameLoadedRef.current) return;
    if (winnerInitials && winnerSavedRef.current === winnerInitials) return;
    if (winnerInitials) winnerSavedRef.current = winnerInitials;
    saveGame({
      sessionId,
      targetScore,
      players: playersPayload,
      winner: winnerInitials,
    });
    if (pin && isHost) {
      const completed_at = new Date().toISOString();
      supabase
        .from("game_history")
        .upsert(
          {
            pin,
            session_id: sessionId,
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
  }, [gameType, pin, isHost, sessionId, targetScore]);

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
  if (!pin && !gameType && !pendingType) {
    return (
      <GamePicker
        onSelect={handleSelectGameType}
        onJoin={joinGame}
        onArchive={() => setShowArchive(true)}
      />
    );
  }

  // ── Game setup: set target score before starting ────────────────────
  if (pendingType && !gameType) {
    const label = GAME_LABELS[pendingType];
    return (
      <div className="min-h-screen bg-paper flex justify-center px-5 py-10 sm:py-14">
        <div className="w-full max-w-sm fade-in">
          <button
            onClick={backToPicker}
            className="flex items-center gap-1.5 text-sm text-ink/60 hover:text-accent transition-colors mb-8"
          >
            <ArrowLeft size={15} /> Back
          </button>
          <div className="microcap mb-1.5">Game setup · <span className="text-accent">{label}</span></div>
          <h1 className="font-display font-bold text-4xl tracking-tight mb-8">{label}</h1>
          {pendingType !== "phase10" && (
            <div className="card-pop p-5 mb-5">
              <label className="block text-xs font-semibold text-ink/60 mb-3">
                {pendingType === "hearts" ? "Ends at score" : "Target score"}
              </label>
              <div className="flex items-center gap-3">
                <TargetInput
                  value={pendingTarget}
                  onCommit={setPendingTarget}
                  maxDigits={5}
                  label="Target score"
                  className="w-28 text-center font-mono font-bold text-2xl bg-paper border-2 border-line rounded-xl focus:border-accent outline-none py-2.5 transition-colors"
                />
                <span className="text-ink/50 text-sm">
                  {pendingType === "hearts"
                    ? "· lowest wins"
                    : pendingType === "uno"
                    ? "· first to bust"
                    : "to win"}
                </span>
              </div>
            </div>
          )}
          {createError && (
            <p className="mb-4 text-sm font-semibold text-coral">
              Couldn&rsquo;t create a table — check your connection and try again.
            </p>
          )}
          <button
            onClick={() => startGame(pendingType, pendingTarget)}
            className="btn btn-accent w-full py-3 text-base flex items-center justify-center gap-2"
          >
            Deal me in <ArrowRight size={16} />
          </button>
        </div>
      </div>
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
            {pin && (
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
            )}
            <button
              onClick={() => setShowArchive(true)}
              className="btn btn-white px-3.5 py-2 text-sm"
            >
              Leaderboard
            </button>
          </div>
        </header>

        {!pin && (
          <div className="mb-6 flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-ink/60 mb-1.5">
                Join a table
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="4-digit PIN"
                maxLength={6}
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === "Enter" && joinInput.length >= 4 && joinGame(joinInput)}
                className="w-full font-mono font-semibold text-center text-sm bg-paper border-2 border-line rounded-lg focus:border-accent outline-none px-3 py-2.5 transition-colors"
              />
            </div>
            <button
              onClick={() => joinGame(joinInput)}
              disabled={joinInput.length < 4}
              className="btn btn-accent px-4 py-2.5 text-sm disabled:opacity-40 flex items-center gap-1.5"
            >
              <ArrowRight size={14} /> Join
            </button>
          </div>
        )}
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
