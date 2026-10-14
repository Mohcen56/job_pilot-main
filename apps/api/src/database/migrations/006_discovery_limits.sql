CREATE TABLE discovery_leases (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
CREATE TABLE discovery_counters (user_id uuid REFERENCES users(id) ON DELETE CASCADE, window_start timestamptz NOT NULL, used integer NOT NULL, PRIMARY KEY(user_id,window_start));
