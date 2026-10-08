-- Web push: one row per browser that said yes to notifications. The device key's hash ties it
-- to a runner (directly, or through player_keys after a recovery), so a player with the game
-- on two phones hears on both. The browser's push endpoint is the key; a 404/410 from the
-- push service, or repeated failures, removes the row.
--   reminded_day: the last Dar day a come-back reminder went to this browser (at most one a day)

CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  created_ms INTEGER NOT NULL,
  reminded_day TEXT,
  fails INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS push_subs_token ON push_subs (token_hash);

-- Notifications already sent for one-off events (a prize, keyed `prize:<id>`), so a re-run
-- of the morning job never sends the same news twice.
CREATE TABLE IF NOT EXISTS push_sent (
  key TEXT PRIMARY KEY,
  sent_ms INTEGER NOT NULL
);
