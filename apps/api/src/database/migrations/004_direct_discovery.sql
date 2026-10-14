ALTER TABLE profiles DROP CONSTRAINT profiles_job_boards_valid;
ALTER TABLE profiles ADD CONSTRAINT profiles_job_boards_valid CHECK (job_boards <@ ARRAY['direct','adzuna','linkedin','indeed','kariyer','jooble']::text[]);
UPDATE profiles SET job_boards = array_prepend('direct',job_boards) WHERE NOT ('direct'=ANY(job_boards));
ALTER TABLE profiles ALTER COLUMN job_boards SET DEFAULT ARRAY['direct','adzuna']::text[];
ALTER TABLE profiles ADD COLUMN career_urls text[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN freshness_days integer CHECK (freshness_days IN (1,3,7,14,30));
ALTER TABLE jobs DROP CONSTRAINT jobs_source_board_valid;
ALTER TABLE jobs ADD CONSTRAINT jobs_source_board_valid CHECK (source_board IN ('direct','adzuna','linkedin','indeed','kariyer','jooble'));
ALTER TABLE jobs ADD COLUMN source_provider text CHECK (source_provider IN ('greenhouse','lever','ashby','smartrecruiters','workable','company','adzuna','jsearch','jooble'));
ALTER TABLE jobs ADD COLUMN external_id text;
ALTER TABLE jobs ADD COLUMN canonical_apply_url text;
ALTER TABLE jobs ADD COLUMN published_at timestamptz;
ALTER TABLE jobs ADD COLUMN workplace_type text NOT NULL DEFAULT 'unknown' CHECK (workplace_type IN ('remote','hybrid','onsite','unknown'));
ALTER TABLE jobs ADD COLUMN geographic_eligibility jsonb;
ALTER TABLE jobs ADD COLUMN experience_level text;
ALTER TABLE jobs ADD COLUMN seniority_match text NOT NULL DEFAULT 'unknown' CHECK (seniority_match IN ('strong','stretch','poor','unknown'));
ALTER TABLE jobs ADD COLUMN discovery_method text CHECK (discovery_method IN ('ats_direct','company_career_page','search_discovery','jsearch','adzuna','jooble'));
ALTER TABLE jobs ADD COLUMN discovery_url text;
ALTER TABLE jobs ADD COLUMN salary_min numeric;
ALTER TABLE jobs ADD COLUMN salary_max numeric;
ALTER TABLE jobs ADD COLUMN salary_currency text;
ALTER TABLE jobs ADD COLUMN match_status text NOT NULL DEFAULT 'pending' CHECK (match_status IN ('pending','scored'));
UPDATE jobs SET match_status='scored' WHERE match_score IS NOT NULL;
CREATE INDEX jobs_published_idx ON jobs(user_id,published_at DESC);
CREATE INDEX jobs_external_idx ON jobs(user_id,source_provider,external_id);
CREATE TABLE career_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 career_url text NOT NULL, provider text NOT NULL, company_identifier text NOT NULL,
 discovery_method text NOT NULL, discovery_url text, last_fetched_at timestamptz,
 jobs_cache jsonb NOT NULL DEFAULT '[]', cache_query text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,career_url)
);
