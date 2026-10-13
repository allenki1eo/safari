-- The shop (server/payments.js): hearts and seed packs paid through Snippe payment links.
-- One row per order: the pack, its price, what it gives, the Snippe checkout it was paid on and
-- how it stands (pending → paid, or expired / cancelled / failed). Hearts land in `hearts` the
-- moment an order is paid; seeds wait until the game collects them (claimed_ms), like prizes.

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  player_id INTEGER NOT NULL,
  pack TEXT NOT NULL,
  price INTEGER NOT NULL,
  hearts INTEGER NOT NULL DEFAULT 0,
  seeds INTEGER NOT NULL DEFAULT 0,
  reference TEXT,
  checkout_url TEXT,
  payment_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_ms INTEGER NOT NULL,
  checked_ms INTEGER,
  paid_ms INTEGER,
  claimed_ms INTEGER
);

CREATE INDEX IF NOT EXISTS orders_player ON orders (player_id, created_ms);
CREATE INDEX IF NOT EXISTS orders_reference ON orders (reference);

CREATE TABLE IF NOT EXISTS hearts (
  player_id INTEGER PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  bought INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0
);

-- Every completed payment Snippe reports, once (its reference), with the order it paid if the
-- link carried one. Payments with no order show on the admin page to sort out by hand.
CREATE TABLE IF NOT EXISTS payments_in (
  reference TEXT PRIMARY KEY,
  order_id TEXT,
  amount INTEGER NOT NULL,
  phone TEXT,
  created_ms INTEGER NOT NULL
);
