ALTER TABLE match_reports
  ADD COLUMN IF NOT EXISTS report_sections JSONB NOT NULL DEFAULT '[]'::jsonb;
