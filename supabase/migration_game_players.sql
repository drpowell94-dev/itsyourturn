-- Run this in the Supabase SQL editor for your project.
-- Creates a per-player row table so concurrent score edits never collide.

CREATE TABLE IF NOT EXISTS public.game_players (
  pin        TEXT        NOT NULL,
  player_id  TEXT        NOT NULL,
  owner_id   TEXT,
  seq        BIGSERIAL   NOT NULL,          -- insertion order, auto-assigned
  state      JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pin, player_id)
);

CREATE INDEX IF NOT EXISTS game_players_pin_idx ON public.game_players (pin);

-- Allow Supabase Realtime to broadcast changes on this table.
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
