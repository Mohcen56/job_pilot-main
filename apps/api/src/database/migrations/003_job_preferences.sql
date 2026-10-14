ALTER TABLE profiles ADD COLUMN job_boards text[] NOT NULL DEFAULT ARRAY['adzuna']::text[];
ALTER TABLE profiles ADD CONSTRAINT profiles_job_boards_valid CHECK (job_boards <@ ARRAY['adzuna','linkedin','indeed','kariyer']::text[]);
ALTER TABLE jobs ADD COLUMN source_board text;
ALTER TABLE jobs ADD CONSTRAINT jobs_source_board_valid CHECK (source_board IN ('adzuna','linkedin','indeed','kariyer'));
