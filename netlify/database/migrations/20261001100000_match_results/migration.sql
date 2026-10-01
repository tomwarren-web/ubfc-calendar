CREATE TABLE IF NOT EXISTS match_results (
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_results_date ON match_results(date);
