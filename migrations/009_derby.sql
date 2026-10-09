-- Derby Day: which side each runner picked (the first pick sticks), and each side's running
-- total of distance. `event` keys the rows so a future derby starts from zero.

CREATE TABLE IF NOT EXISTS derby_fans (
  event TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  side TEXT NOT NULL,
  joined_ms INTEGER NOT NULL,
  PRIMARY KEY (event, player_id)
);

CREATE TABLE IF NOT EXISTS derby_totals (
  event TEXT NOT NULL,
  side TEXT NOT NULL,
  distance INTEGER NOT NULL DEFAULT 0,
  runs INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event, side)
);
