-- Invite links: one row per runner who joined through a friend's link (player_id), and the
-- friend who sent it (referrer_id). A referral counts once the new runner finishes a real run
-- (qualified_ms); `rewarded` marks the ones that pay the inviter (up to a cap), and each side
-- collects their seeds once (referrer_paid_ms, friend_paid_ms).

CREATE TABLE IF NOT EXISTS referrals (
  player_id INTEGER PRIMARY KEY,
  referrer_id INTEGER NOT NULL,
  created_ms INTEGER NOT NULL,
  qualified_ms INTEGER,
  rewarded INTEGER NOT NULL DEFAULT 0,
  referrer_paid_ms INTEGER,
  friend_paid_ms INTEGER
);

CREATE INDEX IF NOT EXISTS referrals_referrer ON referrals (referrer_id, qualified_ms);
