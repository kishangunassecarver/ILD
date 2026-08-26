-- Adds password sign-in to a database created before it existed.
-- Applied once with:
--   npx wrangler d1 execute ilovedurban --remote --file=worker/migrations/0002-passwords.sql
-- (Fresh databases get all of this from schema.sql and never run migrations.)

ALTER TABLE members ADD COLUMN password_hash TEXT;

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash  TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets (email);
