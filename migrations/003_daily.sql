-- One best run per player per Dar es Salaam day.
-- The all-time board stays on `players`. This table is only today's route,
-- and it resets when the calendar day changes (readers filter on `day`).
-- Rank is not stored.

CREATE TABLE IF NOT EXISTS daily_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  distance INTEGER NOT NULL DEFAULT 0 CHECK (distance >= 0),
  duration INTEGER NOT NULL DEFAULT 0 CHECK (duration >= 0),
  seeds INTEGER NOT NULL DEFAULT 0 CHECK (seeds >= 0),
  allies INTEGER NOT NULL DEFAULT 0 CHECK (allies >= 0),
  chapter INTEGER NOT NULL DEFAULT 0 CHECK (chapter >= 0),
  runner TEXT NOT NULL DEFAULT 'zuri',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (day, player_id)
);

CREATE INDEX IF NOT EXISTS daily_scores_board ON daily_scores (day, score DESC, id ASC);
