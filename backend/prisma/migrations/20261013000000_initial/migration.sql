CREATE EXTENSION IF NOT EXISTS "btree_gist";

CREATE TYPE "UserRole" AS ENUM ('COLLABORATOR', 'ADMIN', 'THERAPIST');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "AppointmentStatus" AS ENUM ('RESERVED', 'CANCELLED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW');
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'NOTIFIED', 'CONVERTED', 'CANCELLED');
CREATE TYPE "NotificationKind" AS ENUM ('REMINDER', 'BOOKING_CONFIRMATION', 'WAITLIST_VACANCY', 'CHECK_IN_CONFIRMATION');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

CREATE TABLE "User" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "googleSubject" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Therapist" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  CONSTRAINT "Therapist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AvailabilityWindow" (
  "id" UUID NOT NULL,
  "therapistId" UUID NOT NULL,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AvailabilityWindow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AvailabilityWindow_period_check" CHECK ("endsAt" > "startsAt")
);

CREATE TABLE "ScheduleBlock" (
  "id" UUID NOT NULL,
  "therapistId" UUID NOT NULL,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3) NOT NULL,
  "reason" TEXT,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduleBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScheduleBlock_period_check" CHECK ("endsAt" > "startsAt")
);

CREATE TABLE "Appointment" (
  "id" UUID NOT NULL,
  "collaboratorId" UUID NOT NULL,
  "therapistId" UUID NOT NULL,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3) NOT NULL,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'RESERVED',
  "checkInToken" TEXT NOT NULL,
  "checkedInAt" TIMESTAMPTZ(3),
  "sessionStartedAt" TIMESTAMPTZ(3),
  "sessionEndedAt" TIMESTAMPTZ(3),
  "cancelledAt" TIMESTAMPTZ(3),
  "cancelledById" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Appointment_period_check" CHECK ("endsAt" > "startsAt")
);

CREATE TABLE "WaitlistEntry" (
  "id" UUID NOT NULL,
  "collaboratorId" UUID NOT NULL,
  "therapistId" UUID,
  "desiredStartsAt" TIMESTAMPTZ(3) NOT NULL,
  "desiredEndsAt" TIMESTAMPTZ(3) NOT NULL,
  "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WaitlistEntry_period_check" CHECK ("desiredEndsAt" > "desiredStartsAt")
);

CREATE TABLE "Notification" (
  "id" UUID NOT NULL,
  "appointmentId" UUID,
  "recipientId" UUID NOT NULL,
  "kind" "NotificationKind" NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  "scheduledFor" TIMESTAMPTZ(3) NOT NULL,
  "sentAt" TIMESTAMPTZ(3),
  "error" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
  "id" UUID NOT NULL,
  "actorId" UUID,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "data" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");
CREATE UNIQUE INDEX "Therapist_userId_key" ON "Therapist"("userId");
CREATE INDEX "AvailabilityWindow_therapistId_startsAt_endsAt_idx" ON "AvailabilityWindow"("therapistId", "startsAt", "endsAt");
CREATE INDEX "ScheduleBlock_therapistId_startsAt_endsAt_idx" ON "ScheduleBlock"("therapistId", "startsAt", "endsAt");
CREATE UNIQUE INDEX "Appointment_checkInToken_key" ON "Appointment"("checkInToken");
CREATE INDEX "Appointment_therapistId_startsAt_endsAt_idx" ON "Appointment"("therapistId", "startsAt", "endsAt");
CREATE INDEX "Appointment_collaboratorId_startsAt_idx" ON "Appointment"("collaboratorId", "startsAt");
CREATE INDEX "WaitlistEntry_desiredStartsAt_status_idx" ON "WaitlistEntry"("desiredStartsAt", "status");
CREATE INDEX "Notification_status_scheduledFor_idx" ON "Notification"("status", "scheduledFor");
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

ALTER TABLE "Therapist" ADD CONSTRAINT "Therapist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AvailabilityWindow" ADD CONSTRAINT "AvailabilityWindow_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Defesa final contra duas reservas simultâneas para o mesmo massoterapeuta.
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_therapist_no_overlap"
  EXCLUDE USING gist (
    "therapistId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("status" IN ('RESERVED', 'CHECKED_IN', 'IN_PROGRESS'));
