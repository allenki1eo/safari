-- KIMBIA! players: one row per runner, holding their best run.
--
-- * Names are unique, ignoring case (name_key is the normalised name).
-- * A name belongs to whoever holds its secret token. Only a SHA-256 hash of the
--   token is stored. Rows folded in from the old scores table have no token yet;
--   the first device to post under that name claims it.
-- * The board is ordered by best score, then by who joined first.
-- * The scores table stays as a log of every posted run.

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  token_hash TEXT UNIQUE,
  best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  distance INTEGER NOT NULL DEFAULT 0 CHECK (distance >= 0),
  seeds INTEGER NOT NULL DEFAULT 0 CHECK (seeds >= 0),
  allies INTEGER NOT NULL DEFAULT 0 CHECK (allies >= 0),
  chapter INTEGER NOT NULL DEFAULT 0 CHECK (chapter >= 0),
  runner TEXT NOT NULL DEFAULT 'zuri',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  best_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS players_rank ON players (best_score DESC, id ASC);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- One-time fold of the old per-run rows: one player per name, keeping their best run.
INSERT INTO players (name, name_key, best_score, distance, seeds, allies, chapter, runner, created_at, best_at)
SELECT s.name, lower(trim(s.name)), s.score, s.distance, s.seeds, s.allies, s.chapter, s.runner, s.created_at, s.created_at
FROM scores s
WHERE NOT EXISTS (SELECT 1 FROM meta WHERE key = 'fold_scores_v1')
  AND s.id = (
    SELECT s2.id FROM scores s2
    WHERE lower(trim(s2.name)) = lower(trim(s.name))
    ORDER BY s2.score DESC, s2.id ASC
    LIMIT 1
  )
ORDER BY s.id
ON CONFLICT (name_key) DO NOTHING;

INSERT OR IGNORE INTO meta (key, value) VALUES ('fold_scores_v1', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
