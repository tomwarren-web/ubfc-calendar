-- Track externally-synced bookings (e.g. FA Full-Time fixtures) so the sync
-- can reconcile its own bookings without ever touching manual ones.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source_ref TEXT;
CREATE INDEX IF NOT EXISTS idx_bookings_source_ref ON bookings(source_ref);
