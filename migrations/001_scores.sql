-- KIMBIA! global leaderboard.
-- Rank is not stored. Readers order by score, then by earlier row id.
-- Apply with `npm run db:init`, or let /api/scores create the table on first use.

CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  distance INTEGER NOT NULL DEFAULT 0 CHECK (distance >= 0),
  seeds INTEGER NOT NULL DEFAULT 0 CHECK (seeds >= 0),
  allies INTEGER NOT NULL DEFAULT 0 CHECK (allies >= 0),
  chapter INTEGER NOT NULL DEFAULT 0 CHECK (chapter >= 0),
  runner TEXT NOT NULL DEFAULT 'zuri',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS scores_rank ON scores (score DESC, id ASC);
