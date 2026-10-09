-- Fair play: how often each device and network posts runs (a short sliding window), and the
-- multiplier each day's best run was made with, so prize boards can cap what it counts for.

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  n INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS run_meta (
  day TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  mult INTEGER NOT NULL CHECK (mult >= 1),
  PRIMARY KEY (day, player_id)
);
