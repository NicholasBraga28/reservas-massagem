CREATE TYPE "LocationCode" AS ENUM ('SAO_PAULO', 'LONDRINA');

CREATE TABLE "Location" (
  "id" UUID NOT NULL,
  "code" "LocationCode" NOT NULL,
  "name" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Room" (
  "id" UUID NOT NULL,
  "locationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "checkInToken" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Location" ("id", "code", "name", "timezone") VALUES
  ('00000000-0000-4000-8000-000000000001', 'SAO_PAULO', 'São Paulo', 'America/Sao_Paulo'),
  ('00000000-0000-4000-8000-000000000002', 'LONDRINA', 'Londrina', 'America/Sao_Paulo');

CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");
CREATE UNIQUE INDEX "Room_checkInToken_key" ON "Room"("checkInToken");
CREATE UNIQUE INDEX "Room_locationId_name_key" ON "Room"("locationId", "name");
ALTER TABLE "Room" ADD CONSTRAINT "Room_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AvailabilityWindow" ADD COLUMN "roomId" UUID;
-- O sistema ainda não entrou em produção. Caso existam janelas locais, elas devem ser removidas
-- ou associadas explicitamente a uma sala antes de aplicar esta migração.
ALTER TABLE "AvailabilityWindow" ALTER COLUMN "roomId" SET NOT NULL;
ALTER TABLE "AvailabilityWindow" ADD CONSTRAINT "AvailabilityWindow_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Appointment" ADD COLUMN "roomId" UUID;
ALTER TABLE "Appointment" DROP COLUMN "checkInToken";
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Appointment_roomId_startsAt_endsAt_idx" ON "Appointment"("roomId", "startsAt", "endsAt");

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_room_no_overlap"
  EXCLUDE USING gist (
    "roomId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("roomId" IS NOT NULL AND "status" IN ('RESERVED', 'CHECKED_IN', 'IN_PROGRESS'));
