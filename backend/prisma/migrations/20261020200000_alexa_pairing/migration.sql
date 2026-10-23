CREATE TABLE "alexa_devices" (
    "id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "therapist_id" UUID NOT NULL,
    "paired_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alexa_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "alexa_devices_device_id_key" ON "alexa_devices"("device_id");
CREATE INDEX "alexa_devices_therapist_id_idx" ON "alexa_devices"("therapist_id");

ALTER TABLE "alexa_devices" ADD CONSTRAINT "alexa_devices_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "therapists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "alexa_pairing_codes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "therapist_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "consumed_by_device_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alexa_pairing_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alexa_pairing_codes_therapist_id_idx" ON "alexa_pairing_codes"("therapist_id");
CREATE UNIQUE INDEX "alexa_pairing_codes_unused_code_key" ON "alexa_pairing_codes"("code") WHERE ("consumed_at" IS NULL);

ALTER TABLE "alexa_pairing_codes" ADD CONSTRAINT "alexa_pairing_codes_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "therapists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alexa_pairing_codes" ADD CONSTRAINT "alexa_pairing_codes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alexa_pairing_codes" ADD CONSTRAINT "alexa_pairing_codes_consumed_by_device_id_fkey" FOREIGN KEY ("consumed_by_device_id") REFERENCES "alexa_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
