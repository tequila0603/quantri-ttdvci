BEGIN;

ALTER TABLE ingest.import_batches
  ADD COLUMN IF NOT EXISTS reporting_period TEXT,
  ADD COLUMN IF NOT EXISTS total_rows INTEGER,
  ADD COLUMN IF NOT EXISTS accepted_rows INTEGER,
  ADD COLUMN IF NOT EXISTS rejected_rows INTEGER,
  ADD COLUMN IF NOT EXISTS duplicate_rows INTEGER,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(20, 2),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

ALTER TABLE ingest.import_rows
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS error_field TEXT;

CREATE INDEX IF NOT EXISTS import_batches_file_kind_status_idx
  ON ingest.import_batches (source_sha256, import_kind, status);

COMMIT;
