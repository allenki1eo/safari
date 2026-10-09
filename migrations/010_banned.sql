-- Runners the game's admin has taken off the boards (for example an impossible score).
-- A banned runner can still play; their runs stay off every leaderboard, prize and derby
-- total until they are unbanned.

CREATE TABLE IF NOT EXISTS banned (
  player_id INTEGER PRIMARY KEY,
  reason TEXT NOT NULL DEFAULT '',
  banned_ms INTEGER NOT NULL
);
