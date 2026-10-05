-- Progress codes: a snapshot of a player's save, parked for a few days so it can be opened in
-- another browser on the same phone. iPhone keeps a home-screen app's storage apart from
-- Safari's, so installing the game would otherwise start it from scratch.

CREATE TABLE IF NOT EXISTS transfers (
  code TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS transfers_age ON transfers (created_ms);
