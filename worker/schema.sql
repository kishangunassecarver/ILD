-- Member accounts for I Love Durban.
--
-- Applied with:
--   npm run db:local     (local development)
--   npm run db:remote    (the real database, once created)
--
-- Passwords are PBKDF2-HMAC-SHA256, salted per user, stored as
-- "pbkdf2:<iterations>:<salt>:<hash>" — never in the clear. `password_hash`
-- is nullable: accounts from the email-link era set one through the reset
-- flow, which proves ownership of the address first.

CREATE TABLE IF NOT EXISTS members (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT,
  password_hash TEXT,
  created_at  INTEGER NOT NULL,
  last_seen_at INTEGER
);

-- One-time sign-in links.
--
-- The token is stored hashed. A leaked database backup should not hand someone
-- a set of working sign-in links, which is exactly what storing them in the
-- clear would do.
CREATE TABLE IF NOT EXISTS login_tokens (
  token_hash  TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_tokens_email ON login_tokens (email);

-- One-time password-reset links, same shape and same hashing rule as
-- login_tokens: a leaked backup must not contain working reset links.
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash  TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets (email);

-- Server-side sessions, so signing out actually ends the session rather than
-- politely asking the browser to forget a token.
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  member_id   TEXT NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_member ON sessions (member_id);

-- Saved places, events and deals.
--
-- `kind` and `slug` reference content that lives in WordPress, so there is no
-- foreign key to enforce — a listing can be unpublished while someone still has
-- it saved. The site skips saves it cannot resolve rather than failing.
CREATE TABLE IF NOT EXISTS saves (
  member_id   TEXT NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (member_id, kind, slug)
);

CREATE INDEX IF NOT EXISTS idx_saves_member ON saves (member_id, created_at DESC);

-- Rate limiting for the sign-in endpoint, keyed by whatever we are limiting on
-- (an email address, or a client IP). Cheap counter with a rolling window.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket      TEXT PRIMARY KEY,
  count       INTEGER NOT NULL,
  window_from INTEGER NOT NULL
);

/* ---------------------------------------------------------------------------
 * Business owners
 *
 * A member becomes the owner of a listing by claiming it and having the claim
 * approved. Approval is a human decision made in WordPress — anyone can type
 * "I own this restaurant", so nothing here grants access on its own.
 * ------------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS listing_claims (
  id            TEXT PRIMARY KEY,
  member_id     TEXT NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  -- The listing, as it appears in the site's own content. No foreign key: the
  -- listing lives in WordPress.
  slug          TEXT NOT NULL,
  hub           TEXT NOT NULL,
  -- What the claimant told us about themselves, kept for the person reviewing.
  business_name TEXT,
  contact_name  TEXT,
  contact_phone TEXT,
  role          TEXT,
  note          TEXT,
  -- pending | approved | rejected
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    INTEGER NOT NULL,
  decided_at    INTEGER,
  decided_note  TEXT
);

-- One claim per member per listing, so re-submitting updates rather than piles up.
CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_member_slug ON listing_claims (member_id, slug);
CREATE INDEX IF NOT EXISTS idx_claims_status ON listing_claims (status, created_at);

-- Edits submitted by an approved owner.
--
-- Held here as JSON until someone in WordPress applies them. Nothing an owner
-- types reaches the live site without passing through that review, which is the
-- whole reason this is a queue rather than a write-through.
CREATE TABLE IF NOT EXISTS listing_edits (
  id          TEXT PRIMARY KEY,
  member_id   TEXT NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  hub         TEXT NOT NULL,
  -- JSON object of the fields the owner changed, already validated field by field.
  fields      TEXT NOT NULL,
  -- pending | applied | rejected
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  INTEGER NOT NULL,
  decided_at  INTEGER,
  decided_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_edits_member ON listing_edits (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edits_status ON listing_edits (status, created_at);

-- "List your business" enquiries.
--
-- Emailing these is best-effort; storing them means an enquiry is never lost to
-- a mail provider having a bad afternoon.
CREATE TABLE IF NOT EXISTS enquiries (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  business    TEXT,
  plan        TEXT,
  message     TEXT,
  created_at  INTEGER NOT NULL,
  handled_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_enquiries_created ON enquiries (created_at DESC);
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
