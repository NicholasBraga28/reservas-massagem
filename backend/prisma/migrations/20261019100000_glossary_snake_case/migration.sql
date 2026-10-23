ALTER TYPE "UserRole" RENAME TO "user_role";
ALTER TYPE "UserStatus" RENAME TO "user_status";
ALTER TYPE "AppointmentStatus" RENAME TO "appointment_status";
ALTER TYPE "WaitlistStatus" RENAME TO "waitlist_status";
ALTER TYPE "NotificationKind" RENAME TO "notification_kind";
ALTER TYPE "NotificationStatus" RENAME TO "notification_status";
ALTER TYPE "LocationCode" RENAME TO "location_code";

ALTER TABLE "User" RENAME TO "users";
ALTER TABLE "users" RENAME COLUMN "googleSubject" TO "google_subject";
ALTER TABLE "users" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "users" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "users" RENAME CONSTRAINT "User_pkey" TO "users_pkey";
ALTER INDEX "User_email_key" RENAME TO "users_email_key";
ALTER INDEX "User_googleSubject_key" RENAME TO "users_google_subject_key";

ALTER TABLE "Location" RENAME TO "locations";
ALTER TABLE "locations" RENAME CONSTRAINT "Location_pkey" TO "locations_pkey";
ALTER INDEX "Location_code_key" RENAME TO "locations_code_key";

ALTER TABLE "Room" RENAME TO "rooms";
ALTER TABLE "rooms" RENAME COLUMN "locationId" TO "location_id";
ALTER TABLE "rooms" RENAME COLUMN "checkInToken" TO "check_in_token";
ALTER TABLE "rooms" RENAME CONSTRAINT "Room_pkey" TO "rooms_pkey";
ALTER TABLE "rooms" RENAME CONSTRAINT "Room_locationId_fkey" TO "rooms_location_id_fkey";
ALTER INDEX "Room_checkInToken_key" RENAME TO "rooms_check_in_token_key";
ALTER INDEX "Room_locationId_name_key" RENAME TO "rooms_location_id_name_key";

ALTER TABLE "Therapist" RENAME TO "therapists";
ALTER TABLE "therapists" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "therapists" RENAME CONSTRAINT "Therapist_pkey" TO "therapists_pkey";
ALTER TABLE "therapists" RENAME CONSTRAINT "Therapist_userId_fkey" TO "therapists_user_id_fkey";
ALTER INDEX "Therapist_userId_key" RENAME TO "therapists_user_id_key";

ALTER TABLE "AvailabilityWindow" RENAME TO "schedule_slots";
ALTER TABLE "schedule_slots" RENAME COLUMN "therapistId" TO "therapist_id";
ALTER TABLE "schedule_slots" RENAME COLUMN "roomId" TO "room_id";
ALTER TABLE "schedule_slots" RENAME COLUMN "startsAt" TO "starts_at";
ALTER TABLE "schedule_slots" RENAME COLUMN "endsAt" TO "ends_at";
ALTER TABLE "schedule_slots" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "schedule_slots" RENAME CONSTRAINT "AvailabilityWindow_pkey" TO "schedule_slots_pkey";
ALTER TABLE "schedule_slots" RENAME CONSTRAINT "AvailabilityWindow_period_check" TO "schedule_slots_period_check";
ALTER TABLE "schedule_slots" RENAME CONSTRAINT "AvailabilityWindow_therapistId_fkey" TO "schedule_slots_therapist_id_fkey";
ALTER TABLE "schedule_slots" RENAME CONSTRAINT "AvailabilityWindow_roomId_fkey" TO "schedule_slots_room_id_fkey";
ALTER INDEX "AvailabilityWindow_therapistId_startsAt_endsAt_idx" RENAME TO "schedule_slots_therapist_id_starts_at_ends_at_idx";

ALTER TABLE "ScheduleBlock" RENAME TO "schedule_blocks";
ALTER TABLE "schedule_blocks" RENAME COLUMN "therapistId" TO "therapist_id";
ALTER TABLE "schedule_blocks" RENAME COLUMN "startsAt" TO "starts_at";
ALTER TABLE "schedule_blocks" RENAME COLUMN "endsAt" TO "ends_at";
ALTER TABLE "schedule_blocks" RENAME COLUMN "createdById" TO "created_by_id";
ALTER TABLE "schedule_blocks" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "schedule_blocks" RENAME CONSTRAINT "ScheduleBlock_pkey" TO "schedule_blocks_pkey";
ALTER TABLE "schedule_blocks" RENAME CONSTRAINT "ScheduleBlock_period_check" TO "schedule_blocks_period_check";
ALTER TABLE "schedule_blocks" RENAME CONSTRAINT "ScheduleBlock_therapistId_fkey" TO "schedule_blocks_therapist_id_fkey";
ALTER TABLE "schedule_blocks" RENAME CONSTRAINT "ScheduleBlock_createdById_fkey" TO "schedule_blocks_created_by_id_fkey";
ALTER INDEX "ScheduleBlock_therapistId_startsAt_endsAt_idx" RENAME TO "schedule_blocks_therapist_id_starts_at_ends_at_idx";

ALTER TABLE "Appointment" RENAME TO "appointments";
ALTER TABLE "appointments" RENAME COLUMN "collaboratorId" TO "employee_id";
ALTER TABLE "appointments" RENAME COLUMN "therapistId" TO "therapist_id";
ALTER TABLE "appointments" RENAME COLUMN "roomId" TO "room_id";
ALTER TABLE "appointments" RENAME COLUMN "startsAt" TO "starts_at";
ALTER TABLE "appointments" RENAME COLUMN "endsAt" TO "ends_at";
ALTER TABLE "appointments" RENAME COLUMN "checkedInAt" TO "checked_in_at";
ALTER TABLE "appointments" RENAME COLUMN "sessionStartedAt" TO "session_started_at";
ALTER TABLE "appointments" RENAME COLUMN "sessionEndedAt" TO "session_ended_at";
ALTER TABLE "appointments" RENAME COLUMN "cancelledAt" TO "cancelled_at";
ALTER TABLE "appointments" RENAME COLUMN "cancelledById" TO "cancelled_by_id";
ALTER TABLE "appointments" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "appointments" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "appointments" RENAME CONSTRAINT "Appointment_pkey" TO "appointments_pkey";
ALTER TABLE "appointments" RENAME CONSTRAINT "Appointment_period_check" TO "appointments_period_check";
ALTER TABLE "appointments" RENAME CONSTRAINT "Appointment_collaboratorId_fkey" TO "appointments_employee_id_fkey";
ALTER TABLE "appointments" RENAME CONSTRAINT "Appointment_therapistId_fkey" TO "appointments_therapist_id_fkey";
ALTER TABLE "appointments" RENAME CONSTRAINT "Appointment_roomId_fkey" TO "appointments_room_id_fkey";
ALTER TABLE "appointments" RENAME CONSTRAINT "Appointment_cancelledById_fkey" TO "appointments_cancelled_by_id_fkey";
ALTER TABLE "appointments" RENAME CONSTRAINT "Appointment_therapist_no_overlap" TO "appointments_therapist_no_overlap";
ALTER TABLE "appointments" RENAME CONSTRAINT "Appointment_room_no_overlap" TO "appointments_room_no_overlap";
ALTER INDEX "Appointment_therapistId_startsAt_endsAt_idx" RENAME TO "appointments_therapist_id_starts_at_ends_at_idx";
ALTER INDEX "Appointment_collaboratorId_startsAt_idx" RENAME TO "appointments_employee_id_starts_at_idx";
ALTER INDEX "Appointment_roomId_startsAt_endsAt_idx" RENAME TO "appointments_room_id_starts_at_ends_at_idx";

ALTER TABLE "WaitlistEntry" RENAME TO "waitlist_entries";
ALTER TABLE "waitlist_entries" RENAME COLUMN "collaboratorId" TO "employee_id";
ALTER TABLE "waitlist_entries" RENAME COLUMN "therapistId" TO "therapist_id";
ALTER TABLE "waitlist_entries" RENAME COLUMN "desiredStartsAt" TO "desired_starts_at";
ALTER TABLE "waitlist_entries" RENAME COLUMN "desiredEndsAt" TO "desired_ends_at";
ALTER TABLE "waitlist_entries" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "waitlist_entries" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "waitlist_entries" RENAME CONSTRAINT "WaitlistEntry_pkey" TO "waitlist_entries_pkey";
ALTER TABLE "waitlist_entries" RENAME CONSTRAINT "WaitlistEntry_period_check" TO "waitlist_entries_period_check";
ALTER TABLE "waitlist_entries" RENAME CONSTRAINT "WaitlistEntry_collaboratorId_fkey" TO "waitlist_entries_employee_id_fkey";
ALTER TABLE "waitlist_entries" RENAME CONSTRAINT "WaitlistEntry_therapistId_fkey" TO "waitlist_entries_therapist_id_fkey";
ALTER INDEX "WaitlistEntry_desiredStartsAt_status_idx" RENAME TO "waitlist_entries_desired_starts_at_status_idx";

ALTER TABLE "Notification" RENAME TO "notifications";
ALTER TABLE "notifications" RENAME COLUMN "appointmentId" TO "appointment_id";
ALTER TABLE "notifications" RENAME COLUMN "recipientId" TO "recipient_id";
ALTER TABLE "notifications" RENAME COLUMN "scheduledFor" TO "scheduled_for";
ALTER TABLE "notifications" RENAME COLUMN "sentAt" TO "sent_at";
ALTER TABLE "notifications" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "notifications" RENAME CONSTRAINT "Notification_pkey" TO "notifications_pkey";
ALTER TABLE "notifications" RENAME CONSTRAINT "Notification_appointmentId_fkey" TO "notifications_appointment_id_fkey";
ALTER INDEX "Notification_status_scheduledFor_idx" RENAME TO "notifications_status_scheduled_for_idx";

ALTER TABLE "AuditEvent" RENAME TO "audit_events";
ALTER TABLE "audit_events" RENAME COLUMN "actorId" TO "actor_id";
ALTER TABLE "audit_events" RENAME COLUMN "entityType" TO "entity_type";
ALTER TABLE "audit_events" RENAME COLUMN "entityId" TO "entity_id";
ALTER TABLE "audit_events" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "audit_events" RENAME CONSTRAINT "AuditEvent_pkey" TO "audit_events_pkey";
ALTER TABLE "audit_events" RENAME CONSTRAINT "AuditEvent_actorId_fkey" TO "audit_events_actor_id_fkey";
ALTER INDEX "AuditEvent_entityType_entityId_createdAt_idx" RENAME TO "audit_events_entity_type_entity_id_created_at_idx";
ALTER INDEX "AuditEvent_createdAt_idx" RENAME TO "audit_events_created_at_idx";

UPDATE "audit_events" SET "entity_type" = 'ScheduleSlot' WHERE "entity_type" = 'AvailabilityWindow';
