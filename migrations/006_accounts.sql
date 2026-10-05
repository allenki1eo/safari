-- Getting a runner back. A runner name belongs to whoever holds its device key, and that key
-- lives in one browser's storage: switching browser, opening the game inside WhatsApp or
-- Instagram, or clearing site data loses it, and the player's own name then reads "taken".
--
-- * accounts: a recovery PIN (scrypt hash) and the player's cloud save, per player. Wrong
--   PINs are counted and lock the account for a while. An admin can issue a one-time
--   recovery code for a runner that never set a PIN; it works in place of the PIN once.
-- * player_keys: extra device keys for a runner (a recovered phone gets its own), so every
--   device the player has recovered on keeps posting under their name.

CREATE TABLE IF NOT EXISTS accounts (
  player_id INTEGER PRIMARY KEY,
  pin_hash TEXT,
  pin_salt TEXT,
  code_hash TEXT,
  code_ms INTEGER,
  fails INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  save TEXT,
  save_ms INTEGER
);

CREATE TABLE IF NOT EXISTS player_keys (
  token_hash TEXT PRIMARY KEY,
  player_id INTEGER NOT NULL,
  created_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS player_keys_player ON player_keys (player_id);
