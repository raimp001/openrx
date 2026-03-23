-- OpenRx core Prisma tables
-- Run this in the Supabase SQL editor when the app database has the
-- runtime/ledger tables but is still missing the original application tables
-- such as public.users, notifications, appointments, and prescriptions.
--
-- This script is intentionally idempotent for the "tables missing entirely"
-- case that production is currently in.

CREATE SCHEMA IF NOT EXISTS "public";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('PATIENT', 'DOCTOR', 'ADMIN', 'PHARMACIST');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppointmentStatus') THEN
    CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PrescriptionStatus') THEN
    CREATE TYPE "PrescriptionStatus" AS ENUM ('ACTIVE', 'FILLED', 'CANCELLED', 'EXPIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageStatus') THEN
    CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
    CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
    CREATE TYPE "NotificationType" AS ENUM ('APPOINTMENT_REMINDER', 'PRESCRIPTION_READY', 'MESSAGE_RECEIVED', 'LAB_RESULT', 'PAYMENT_DUE', 'GENERAL');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "image" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'PATIENT',
  "walletAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "patient_profiles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dateOfBirth" TIMESTAMP(3),
  "gender" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "emergencyContact" TEXT,
  "bloodType" TEXT,
  "allergies" TEXT[],
  "insuranceId" TEXT,
  "insuranceProvider" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "patient_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "doctor_profiles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "specialty" TEXT NOT NULL,
  "licenseNumber" TEXT NOT NULL,
  "bio" TEXT,
  "yearsExperience" INTEGER,
  "consultationFee" DOUBLE PRECISION,
  "availableSlots" JSONB,
  "rating" DOUBLE PRECISION DEFAULT 0,
  "totalReviews" INTEGER NOT NULL DEFAULT 0,
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "acceptsInsurance" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "doctor_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "appointments" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "duration" INTEGER NOT NULL DEFAULT 30,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
  "type" TEXT NOT NULL DEFAULT 'consultation',
  "reason" TEXT,
  "notes" TEXT,
  "meetingUrl" TEXT,
  "transactionHash" TEXT,
  "paymentAmount" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "prescriptions" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "appointmentId" TEXT,
  "status" "PrescriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "diagnosis" TEXT,
  "notes" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "medications" (
  "id" TEXT NOT NULL,
  "prescriptionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "dosage" TEXT NOT NULL,
  "frequency" TEXT NOT NULL,
  "duration" TEXT,
  "instructions" TEXT,
  "quantity" INTEGER,
  "refills" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "medications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "medical_records" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "recordType" TEXT NOT NULL,
  "recordDate" TIMESTAMP(3) NOT NULL,
  "attachments" TEXT[],
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "lab_results" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "testName" TEXT NOT NULL,
  "testDate" TIMESTAMP(3) NOT NULL,
  "results" JSONB NOT NULL,
  "normalRange" JSONB,
  "isAbnormal" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "orderedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vital_signs" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bloodPressure" TEXT,
  "heartRate" INTEGER,
  "temperature" DOUBLE PRECISION,
  "respiratoryRate" INTEGER,
  "oxygenSaturation" DOUBLE PRECISION,
  "weight" DOUBLE PRECISION,
  "height" DOUBLE PRECISION,
  "bmi" DOUBLE PRECISION,
  "notes" TEXT,
  CONSTRAINT "vital_signs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "receiverId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
  "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
  "attachments" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payments" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "appointmentId" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USDC',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "transactionHash" TEXT,
  "network" TEXT NOT NULL DEFAULT 'base',
  "fromAddress" TEXT,
  "toAddress" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "doctor_reviews" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "doctor_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "agent_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "agentType" TEXT NOT NULL,
  "sessionData" JSONB NOT NULL,
  "messages" JSONB[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "resourceId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_walletAddress_key" ON "users"("walletAddress");
CREATE UNIQUE INDEX IF NOT EXISTS "patient_profiles_userId_key" ON "patient_profiles"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "doctor_profiles_userId_key" ON "doctor_profiles"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "doctor_profiles_licenseNumber_key" ON "doctor_profiles"("licenseNumber");
CREATE INDEX IF NOT EXISTS "appointments_patientId_idx" ON "appointments"("patientId");
CREATE INDEX IF NOT EXISTS "appointments_doctorId_idx" ON "appointments"("doctorId");
CREATE INDEX IF NOT EXISTS "appointments_scheduledAt_idx" ON "appointments"("scheduledAt");
CREATE INDEX IF NOT EXISTS "prescriptions_patientId_idx" ON "prescriptions"("patientId");
CREATE INDEX IF NOT EXISTS "prescriptions_doctorId_idx" ON "prescriptions"("doctorId");
CREATE INDEX IF NOT EXISTS "medications_prescriptionId_idx" ON "medications"("prescriptionId");
CREATE INDEX IF NOT EXISTS "medical_records_patientId_idx" ON "medical_records"("patientId");
CREATE INDEX IF NOT EXISTS "lab_results_patientId_idx" ON "lab_results"("patientId");
CREATE INDEX IF NOT EXISTS "vital_signs_patientId_idx" ON "vital_signs"("patientId");
CREATE INDEX IF NOT EXISTS "vital_signs_recordedAt_idx" ON "vital_signs"("recordedAt");
CREATE INDEX IF NOT EXISTS "messages_senderId_idx" ON "messages"("senderId");
CREATE INDEX IF NOT EXISTS "messages_receiverId_idx" ON "messages"("receiverId");
CREATE INDEX IF NOT EXISTS "notifications_userId_idx" ON "notifications"("userId");
CREATE INDEX IF NOT EXISTS "notifications_isRead_idx" ON "notifications"("isRead");
CREATE UNIQUE INDEX IF NOT EXISTS "payments_appointmentId_key" ON "payments"("appointmentId");
CREATE UNIQUE INDEX IF NOT EXISTS "payments_transactionHash_key" ON "payments"("transactionHash");
CREATE INDEX IF NOT EXISTS "payments_userId_idx" ON "payments"("userId");
CREATE INDEX IF NOT EXISTS "payments_transactionHash_idx" ON "payments"("transactionHash");
CREATE INDEX IF NOT EXISTS "doctor_reviews_doctorId_idx" ON "doctor_reviews"("doctorId");
CREATE UNIQUE INDEX IF NOT EXISTS "doctor_reviews_doctorId_patientId_key" ON "doctor_reviews"("doctorId", "patientId");
CREATE INDEX IF NOT EXISTS "agent_sessions_userId_idx" ON "agent_sessions"("userId");
CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX IF NOT EXISTS "audit_logs_resource_idx" ON "audit_logs"("resource");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_profiles_userId_fkey') THEN
    ALTER TABLE "patient_profiles"
      ADD CONSTRAINT "patient_profiles_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_profiles_userId_fkey') THEN
    ALTER TABLE "doctor_profiles"
      ADD CONSTRAINT "doctor_profiles_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_patientId_fkey') THEN
    ALTER TABLE "appointments"
      ADD CONSTRAINT "appointments_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_doctorId_fkey') THEN
    ALTER TABLE "appointments"
      ADD CONSTRAINT "appointments_doctorId_fkey"
      FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prescriptions_patientId_fkey') THEN
    ALTER TABLE "prescriptions"
      ADD CONSTRAINT "prescriptions_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prescriptions_doctorId_fkey') THEN
    ALTER TABLE "prescriptions"
      ADD CONSTRAINT "prescriptions_doctorId_fkey"
      FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prescriptions_appointmentId_fkey') THEN
    ALTER TABLE "prescriptions"
      ADD CONSTRAINT "prescriptions_appointmentId_fkey"
      FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medications_prescriptionId_fkey') THEN
    ALTER TABLE "medications"
      ADD CONSTRAINT "medications_prescriptionId_fkey"
      FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medical_records_patientId_fkey') THEN
    ALTER TABLE "medical_records"
      ADD CONSTRAINT "medical_records_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lab_results_patientId_fkey') THEN
    ALTER TABLE "lab_results"
      ADD CONSTRAINT "lab_results_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vital_signs_patientId_fkey') THEN
    ALTER TABLE "vital_signs"
      ADD CONSTRAINT "vital_signs_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_senderId_fkey') THEN
    ALTER TABLE "messages"
      ADD CONSTRAINT "messages_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_receiverId_fkey') THEN
    ALTER TABLE "messages"
      ADD CONSTRAINT "messages_receiverId_fkey"
      FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_userId_fkey') THEN
    ALTER TABLE "notifications"
      ADD CONSTRAINT "notifications_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_userId_fkey') THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_appointmentId_fkey') THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_appointmentId_fkey"
      FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_reviews_doctorId_fkey') THEN
    ALTER TABLE "doctor_reviews"
      ADD CONSTRAINT "doctor_reviews_doctorId_fkey"
      FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_userId_fkey') THEN
    ALTER TABLE "audit_logs"
      ADD CONSTRAINT "audit_logs_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
