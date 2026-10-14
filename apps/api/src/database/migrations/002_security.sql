ALTER TABLE users ADD COLUMN email_verified boolean NOT NULL DEFAULT false;
UPDATE users SET email_verified=true WHERE id IN (SELECT user_id FROM oauth_accounts);
DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE NOT email_verified);

CREATE TABLE email_verifications (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX email_verifications_user_idx ON email_verifications(user_id);
CREATE TABLE usage_counters (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  used integer NOT NULL DEFAULT 0,
  PRIMARY KEY(key,window_start)
);
CREATE TABLE usage_leases (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX usage_leases_user_idx ON usage_leases(user_id);
