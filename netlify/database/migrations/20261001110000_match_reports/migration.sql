CREATE TABLE IF NOT EXISTS match_reports (
  source_ref TEXT PRIMARY KEY,
  team_name TEXT NOT NULL,
  date TEXT NOT NULL,
  start_min INTEGER NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  venue TEXT,
  competition TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  headline TEXT NOT NULL,
  summary TEXT NOT NULL,
  lineup JSONB NOT NULL DEFAULT '[]'::jsonb,
  substitutes JSONB NOT NULL DEFAULT '[]'::jsonb,
  goalscorers JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_posts JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_reports_date ON match_reports(date);
