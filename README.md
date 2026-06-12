# It's Your Turn

A calm, shared score sheet for game night. Pick a game, host a table, share a
4-digit PIN, and everyone's phone follows along on one live sheet. Supports
**Flip 7**, **Phase 10**, and **Spades**.

## Design language

A playful game-night theme that stays easy to read and tap:

- **Playful** — a cream tabletop with card-suit colors (gold, teal, coral,
  plum), chunky rounded display type (Baloo 2), and buttons that press down
  like game pieces. Each game has its own accent: marigold for Flip 7, teal
  for Phase 10, plum for Spades.
- **Readable** — dark ink text on light surfaces, a real score-sheet grid,
  tabular mono numerals, and big touch targets for phones being passed
  around a table.
- **AI-native** — a "table reader" narrates the state of the game beneath the
  board in plain language ("KAT leads JM by 12 and needs 58 more to reach
  200."). It's deterministic and instant — no API call, no latency, no
  hallucination — but it gives the app a single conversational voice.

## Tech stack

- **Vite 6 + React 19 + TypeScript** (plain SPA — no SSR, no router; the only
  deep link is `/?pin=XXXX`)
- **Tailwind CSS v4** with CSS custom properties for per-game accent theming
  (`data-game="flip7" | "phase10" | "spades"` swaps `--accent`)
- **Supabase** (Postgres + Realtime) for live table sync
- **lucide-react** icons; Newsreader / Inter / JetBrains Mono type

## Project structure

```
src/
  main.tsx                 # React bootstrap
  App.tsx                  # State machine: picker → table → archive; sync loop
  styles.css               # Design tokens (paper/ink/line/accent) + microcap
  lib/
    games.ts               # GameType union + labels + type guard
    history.ts             # localStorage history CRUD + session dedupe
    reader.ts              # Table-reader narration (deterministic)
    supabase.ts            # Supabase client (env-overridable)
  components/
    GamePicker.tsx         # Landing: numbered game list + PIN join
    HistoryView.tsx        # Per-PIN (server) or local game history
    Calculator.tsx         # Flip 7 floating hand calculator (1–12, ×2, +15)
    Reader.tsx             # The narrator's serif aside
    Confetti.tsx           # Muted-palette canvas confetti
    games/
      Flip7Board.tsx       # Score grid + round pager + calculator
      Phase10Board.tsx     # Score grid + phase stepper
      SpadesBoard.tsx      # Two team panels, bid/tricks steppers, hand log
```

## Multiplayer model

1. **Host a table** → inserts a row into `public.games` keyed by a random
   4-digit PIN; the URL becomes `/?pin=XXXX`.
2. **Guests** enter the PIN (or follow the link) → subscribe to Supabase
   Realtime on `game-{pin}` and get a claim dialog: pick your seat or add a
   new one. Each browser has a persistent `deviceId` (localStorage) used for
   host detection, seat ownership, and edit gating.
3. **Sync**: local edits debounce 200 ms, then push with a compare-and-set on
   `updated_at`. On conflict the client re-fetches and applies the latest
   state.
4. **History**: when a winner is declared, the game is upserted into
   `game_history` (`ON CONFLICT (pin, session_id)`) and mirrored to
   localStorage.

## Scoring rules

- **Flip 7** — first to the target (default 200) wins, highest first. The
  floating calculator adds card values 0–12, doubles (×2), and the +15 bonus,
  then commits to a player's next empty round.
- **Phase 10** — phases 1–10; phase 11 means done. First to clear all phases
  wins; lowest total breaks ties. Sort: finished, then furthest phase, then
  lowest score.
- **Spades** — exactly two teams, first to the target (default 500). A hand
  finalizes only when both bids and both trick counts are valid and tricks sum
  to 13. Made bid: `bid × 10 + bags`; missed bid: `−bid × 10`. Nil and bag
  penalties are intentionally not modeled.

## Run it

```bash
bun install        # or npm install
bun dev            # or npm run dev
npm run build      # typecheck + production build
```

The app ships pointing at the existing Supabase project (the publishable anon
key is public by design — the schema is PIN-scoped with permissive RLS and
holds no PII). To use your own project, set:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### Database schema

```sql
create table public.games (
  pin text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  game_type text not null default 'flip7'
);
alter table public.games enable row level security;
create policy "anyone read games" on public.games for select using (true);
create policy "anyone insert games" on public.games for insert with check (true);
create policy "anyone update games" on public.games for update using (true) with check (true);
alter publication supabase_realtime add table public.games;
alter table public.games replica identity full;

create table public.game_history (
  id uuid not null default gen_random_uuid() primary key,
  pin text not null,
  session_id uuid not null,
  winner text,
  target_score integer not null default 200,
  players jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null default now(),
  game_type text not null default 'flip7',
  unique (pin, session_id)
);
create index idx_game_history_pin_completed_at on public.game_history (pin, completed_at desc);
alter table public.game_history enable row level security;
create policy "anyone read game_history" on public.game_history for select using (true);
create policy "anyone insert game_history" on public.game_history for insert with check (true);
create policy "anyone update game_history" on public.game_history for update using (true) with check (true);
alter publication supabase_realtime add table public.game_history;

-- optional: clean up stale tables hourly
select cron.schedule('delete-inactive-games', '0 * * * *',
  $$ delete from public.games where updated_at < now() - interval '24 hours'; $$);
```

## Testing multiplayer locally

1. Open `http://localhost:5173`, pick a game, tap **Host a table**.
2. Copy the invite link (or the PIN) from the header chip.
3. Open `http://localhost:5173/?pin=XXXX` in an incognito window.
4. Claim a seat or add yourself; edits sync both ways within ~200 ms.
