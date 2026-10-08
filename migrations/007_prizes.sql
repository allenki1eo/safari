-- Prizes for the top runners of each day, week and month (Dar es Salaam calendar).
-- Boards are built from daily_scores, so nothing new is stored while a period runs. Once it
-- closes, the first request after midnight writes its top ten here (the meta row
-- `prizes:<kind>:<period>` marks it done), and each winner collects on their next visit.
--   kind:   day | week | month
--   period: the day (YYYY-MM-DD), the Monday that starts the week, or the month (YYYY-MM)

CREATE TABLE IF NOT EXISTS prizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  period TEXT NOT NULL,
  rank INTEGER NOT NULL CHECK (rank >= 1),
  player_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  runner TEXT NOT NULL DEFAULT 'zuri',
  score INTEGER NOT NULL CHECK (score >= 0),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  created_ms INTEGER NOT NULL,
  claimed_ms INTEGER,
  UNIQUE (kind, period, rank),
  UNIQUE (kind, period, player_id)
);

CREATE INDEX IF NOT EXISTS prizes_unclaimed ON prizes (player_id, claimed_ms);
