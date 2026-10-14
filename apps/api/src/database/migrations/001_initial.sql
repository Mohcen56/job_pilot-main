CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  avatar_url text,
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE oauth_accounts (
  provider text NOT NULL CHECK (provider IN ('google','github')),
  subject text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY(provider,subject)
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE oauth_states (
  state_hash text PRIMARY KEY,
  provider text NOT NULL,
  verifier text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE auth_limits (
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name text, email text, phone text, location text, current_title text,
  experience_level text, years_experience integer CHECK (years_experience >= 0),
  skills text[] NOT NULL DEFAULT '{}', industries text[] NOT NULL DEFAULT '{}',
  work_experience jsonb, education jsonb,
  job_titles_seeking text[] NOT NULL DEFAULT '{}', remote_preference text,
  preferred_locations text[] NOT NULL DEFAULT '{}', salary_expectation text,
  cover_letter_tone text, linkedin_url text, portfolio_url text,
  work_authorization text, resume_pdf_url text, linkedin_context_id text,
  linkedin_connected boolean NOT NULL DEFAULT false, is_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK(status IN ('running','completed','failed')),
  job_title_searched text, location_searched text, jobs_found integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
  UNIQUE(id,user_id)
);
CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  run_id uuid,
  source text NOT NULL CHECK(source IN ('search','url')),
  source_url text, external_apply_url text, title text, company text, location text,
  salary text, job_type text, about_role text,
  responsibilities text[] NOT NULL DEFAULT '{}', requirements text[] NOT NULL DEFAULT '{}',
  nice_to_have text[] NOT NULL DEFAULT '{}', benefits text[] NOT NULL DEFAULT '{}',
  about_company text, match_score integer CHECK(match_score BETWEEN 0 AND 100), match_reason text,
  matched_skills text[] NOT NULL DEFAULT '{}', missing_skills text[] NOT NULL DEFAULT '{}',
  cover_letter text, tailored_resume_url text, tailored_match_score integer,
  is_tailored boolean NOT NULL DEFAULT false, company_research jsonb,
  found_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,user_id),
  FOREIGN KEY(run_id,user_id) REFERENCES agent_runs(id,user_id)
);
CREATE INDEX jobs_user_found_idx ON jobs(user_id,found_at DESC);
CREATE INDEX jobs_user_score_idx ON jobs(user_id,match_score DESC);
CREATE TABLE agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  run_id uuid, job_id uuid, message text NOT NULL,
  level text NOT NULL CHECK(level IN ('info','success','warning','error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(run_id,user_id) REFERENCES agent_runs(id,user_id),
  FOREIGN KEY(job_id,user_id) REFERENCES jobs(id,user_id)
);
CREATE TABLE app_admins (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ai_settings (
  id text PRIMARY KEY CHECK(id='global'),
  provider text NOT NULL DEFAULT 'gemini' CHECK(provider IN ('gemini','openai','groq')),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ai_settings(id,provider) VALUES('global','gemini');
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER ai_settings_updated BEFORE UPDATE ON ai_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
