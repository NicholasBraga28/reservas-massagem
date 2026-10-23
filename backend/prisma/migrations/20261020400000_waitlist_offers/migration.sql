ALTER TYPE "waitlist_status" ADD VALUE 'EXPIRED';

ALTER TABLE "waitlist_entries"
  ADD COLUMN "offered_at" TIMESTAMPTZ(3),
  ADD COLUMN "offer_expires_at" TIMESTAMPTZ(3);

CREATE INDEX "waitlist_entries_status_desired_starts_at_desired_ends_at_created_at_idx"
  ON "waitlist_entries"("status", "desired_starts_at", "desired_ends_at", "created_at");

ALTER TABLE "notifications"
  ADD COLUMN "message" TEXT,
  ADD COLUMN "spoken_text" TEXT;
