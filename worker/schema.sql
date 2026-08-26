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
