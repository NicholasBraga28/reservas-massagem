ALTER TYPE "notification_kind" ADD VALUE 'POSSIBLE_NO_SHOW';

CREATE UNIQUE INDEX "notifications_appointment_id_recipient_id_kind_key"
  ON "notifications"("appointment_id", "recipient_id", "kind");
