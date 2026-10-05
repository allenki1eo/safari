-- Friend challenges: a finished run (route + shadow-runner recording) shared as a link,
-- optionally with a coin bet. The first friend to accept the bet matches the stake; whoever
-- wins takes the pot. Times are epoch milliseconds from the server clock.
--   status: open (waiting for a taker) | taken (a friend is running) | settled | expired
--   winner: host | rival (a tie goes to the host — the challenger has to be beaten)

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  host_hash TEXT NOT NULL,
  host_name TEXT NOT NULL,
  runner TEXT NOT NULL DEFAULT 'zuri',
  score INTEGER NOT NULL CHECK (score >= 0),
  distance INTEGER NOT NULL DEFAULT 0 CHECK (distance >= 0),
  duration INTEGER NOT NULL DEFAULT 0 CHECK (duration >= 0),
  start_region INTEGER NOT NULL DEFAULT 0 CHECK (start_region >= 0),
  route TEXT NOT NULL,
  track TEXT NOT NULL DEFAULT '',
  stake INTEGER NOT NULL DEFAULT 0 CHECK (stake >= 0),
  status TEXT NOT NULL DEFAULT 'open',
  rival_hash TEXT,
  rival_name TEXT,
  rival_score INTEGER,
  winner TEXT,
  host_paid INTEGER NOT NULL DEFAULT 0,
  created_ms INTEGER NOT NULL,
  taken_ms INTEGER,
  settled_ms INTEGER
);

CREATE INDEX IF NOT EXISTS challenges_host ON challenges (host_hash, host_paid);
