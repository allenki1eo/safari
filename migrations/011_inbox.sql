-- The in-game inbox: news for one runner (player_id) or for everyone (player_id NULL, the
-- admin's announcements). Rows hold a kind and its details as JSON, so the game can show each
-- message in the player's own language. `ref` keeps one-off news (a prize) from being written
-- twice when two servers settle the same board at once.

CREATE TABLE IF NOT EXISTS inbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER,
  kind TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  ref TEXT UNIQUE,
  created_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS inbox_player ON inbox (player_id, created_ms);
