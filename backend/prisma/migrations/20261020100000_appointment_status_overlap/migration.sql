ALTER TABLE "appointments" ALTER COLUMN "status" DROP DEFAULT;

UPDATE "appointments" AS "appointment"
SET "room_id" = (
  SELECT "slot"."room_id"
  FROM "schedule_slots" AS "slot"
  WHERE "slot"."therapist_id" = "appointment"."therapist_id"
    AND "slot"."starts_at" <= "appointment"."starts_at"
    AND "slot"."ends_at" >= "appointment"."ends_at"
  ORDER BY "slot"."starts_at", "slot"."id"
  LIMIT 1
)
WHERE "appointment"."room_id" IS NULL;

DO $$
DECLARE
  "appointments_without_room" TEXT;
BEGIN
  SELECT string_agg("id"::TEXT, ', ' ORDER BY "starts_at") INTO "appointments_without_room"
  FROM "appointments"
  WHERE "room_id" IS NULL;

  IF "appointments_without_room" IS NOT NULL THEN
    RAISE EXCEPTION 'TK-01.03: atendimentos sem sala e sem período da agenda do mesmo massoterapeuta que contenha o horário: %. Informe a sala desses atendimentos ou recrie o banco local com "npx prisma migrate reset".', "appointments_without_room";
  END IF;
END $$;

ALTER TABLE "appointments" DROP CONSTRAINT "appointments_room_id_fkey";
ALTER TABLE "appointments" ALTER COLUMN "room_id" SET NOT NULL;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointments" DROP CONSTRAINT "appointments_therapist_no_overlap";
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_therapist_no_overlap"
  EXCLUDE USING gist (
    "therapist_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("status" IN ('BOOKED', 'CONFIRMED', 'CHECKED_IN', 'POSSIBLE_NO_SHOW', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW'));

ALTER TABLE "appointments" DROP CONSTRAINT "appointments_room_no_overlap";
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_room_no_overlap"
  EXCLUDE USING gist (
    "room_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("status" IN ('BOOKED', 'CONFIRMED', 'CHECKED_IN', 'POSSIBLE_NO_SHOW', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW'));
