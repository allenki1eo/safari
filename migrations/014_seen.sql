-- Which friend challenges a runner is finished with (played, declined), so the challenge card
-- doesn't come back on reload or on their other devices; and how far each runner has read their
-- inbox, so the unread badge is the same on every device.

CREATE TABLE IF NOT EXISTS challenge_done (
  challenge_id TEXT NOT NULL,
  player_hash TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'played',
  done_ms INTEGER NOT NULL,
  PRIMARY KEY (challenge_id, player_hash)
);

CREATE TABLE IF NOT EXISTS inbox_seen (
  player_id INTEGER PRIMARY KEY,
  seen_ms INTEGER NOT NULL
);
