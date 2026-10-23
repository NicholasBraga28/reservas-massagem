CREATE TABLE "business_rules" (
    "id" SMALLINT NOT NULL DEFAULT 1,
    "booking_min_notice_minutes" INTEGER NOT NULL,
    "cancellation_min_notice_minutes" INTEGER NOT NULL,
    "late_arrival_tolerance_minutes" INTEGER NOT NULL,
    "check_in_early_minutes" INTEGER NOT NULL,
    "reminder_lead_minutes" INTEGER NOT NULL,
    "reminder_confirmation_tolerance_minutes" INTEGER NOT NULL,
    "waitlist_acceptance_minutes" INTEGER NOT NULL,
    "session_duration_minutes" INTEGER NOT NULL,
    "slot_step_minutes" INTEGER NOT NULL,
    "booking_horizon_days" INTEGER NOT NULL,
    "max_active_bookings_per_employee" INTEGER NOT NULL,
    "work_days" INTEGER[] NOT NULL,
    "work_start_minutes" INTEGER NOT NULL,
    "lunch_start_minutes" INTEGER NOT NULL,
    "lunch_end_minutes" INTEGER NOT NULL,
    "work_end_minutes" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "business_rules_single_row" CHECK ("id" = 1)
);
