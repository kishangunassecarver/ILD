-- Publisher-submitted events, mirroring listing_submissions: nothing shows on
-- the site until a person approves it in WordPress.
CREATE TABLE IF NOT EXISTS event_submissions (
  id           TEXT PRIMARY KEY,
  member_id    TEXT NOT NULL,
  slug         TEXT NOT NULL,
  fields       TEXT NOT NULL,           -- JSON: title, date, venue, area, category, blurb…
  image_url    TEXT,
  tier         TEXT NOT NULL DEFAULT 'free',     -- free | featured | premium (flips when paid)
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | deleted
  created_at   INTEGER NOT NULL,
  decided_at   INTEGER,
  decided_note TEXT
);

-- One live submission per slug; rejected ones free the slug up again.
CREATE UNIQUE INDEX IF NOT EXISTS event_submissions_slug
  ON event_submissions (slug) WHERE status != 'rejected';

-- Event tier purchases are ONE-OFF payments (an event ends; nothing recurs).
-- The row id doubles as PayFast's m_payment_id, like subscriptions.
CREATE TABLE IF NOT EXISTS event_orders (
  id           TEXT PRIMARY KEY,
  member_id    TEXT NOT NULL,
  slug         TEXT NOT NULL,
  tier         TEXT NOT NULL,                    -- featured | premium
  amount_cents INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'initiated',-- initiated | paid | failed
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS event_orders_slug ON event_orders (slug);
CREATE INDEX IF NOT EXISTS event_orders_member ON event_orders (member_id);
