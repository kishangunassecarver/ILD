-- Owner-created listings and PayFast premium subscriptions.
-- Applied once with:
--   npx wrangler d1 execute ilovedurban --remote --file=worker/migrations/0003-listings-and-billing.sql

-- A brand-new listing an owner submitted from the dashboard. Nothing here is
-- public — WordPress reads the queue, and approving there creates the actual
-- listing post (and an approved claim, so the owner can edit it afterwards).
CREATE TABLE IF NOT EXISTS listing_submissions (
  id           TEXT PRIMARY KEY,
  member_id    TEXT NOT NULL,
  slug         TEXT NOT NULL,
  hub          TEXT NOT NULL,
  fields       TEXT NOT NULL,           -- JSON: name, blurb, body, contact…
  image_url    TEXT,                    -- served from our own /api/media/…
  plan         TEXT NOT NULL DEFAULT 'free',
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  decided_at   INTEGER,
  decided_note TEXT,
  created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_listing_submissions_member
  ON listing_submissions (member_id, created_at);

-- One live-or-pending submission per slug; a rejected one frees the name.
CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_submissions_slug
  ON listing_submissions (slug) WHERE status != 'rejected';

-- Premium subscriptions, one per listing. `id` doubles as PayFast's
-- m_payment_id, so the ITN can find its way back.
CREATE TABLE IF NOT EXISTS subscriptions (
  id            TEXT PRIMARY KEY,
  member_id     TEXT NOT NULL,
  slug          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'initiated', -- initiated | active | cancelled | failed
  pf_token      TEXT,                              -- PayFast's handle, used to cancel
  amount_cents  INTEGER NOT NULL,
  last_paid_at  INTEGER,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_member ON subscriptions (member_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_slug ON subscriptions (slug);

-- Every ITN that changed anything, for reconciliation. The PayFast payment id
-- is the primary key, so a re-delivered notification is naturally idempotent.
CREATE TABLE IF NOT EXISTS payments (
  pf_payment_id   TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  status          TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL,
  created_at      INTEGER NOT NULL
);
