-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('BUYER', 'OWNER', 'AGENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "property_type" AS ENUM ('RUMAH', 'KOS', 'APARTEMEN', 'TANAH');

-- CreateEnum
CREATE TYPE "deal_type" AS ENUM ('DIJUAL', 'DISEWA');

-- CreateEnum
CREATE TYPE "listing_status" AS ENUM ('DRAFT', 'PUBLISHED', 'SOLD', 'RENTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "certificate" AS ENUM ('SHM', 'HGB', 'STRATA', 'GIRIK_AJB');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('KPR', 'CASH');

-- CreateEnum
CREATE TYPE "build_status" AS ENUM ('READY', 'INDEN');

-- CreateEnum
CREATE TYPE "ipl_mode" AS ENUM ('BAYAR', 'GRATIS');

-- CreateEnum
CREATE TYPE "legal_verification" AS ENUM ('VERIFIED', 'PROSES');

-- CreateEnum
CREATE TYPE "submitter_role" AS ENUM ('PEMILIK', 'KUASA');

-- CreateEnum
CREATE TYPE "submission_stage" AS ENUM ('REVIEW', 'REVISION', 'SURVEY', 'APPROVAL', 'APPROVED', 'LIVE');

-- CreateEnum
CREATE TYPE "step_state" AS ENUM ('DONE', 'CURRENT', 'NEXT');

-- CreateEnum
CREATE TYPE "lead_source" AS ENUM ('WHATSAPP', 'CHATBOT', 'KPR', 'COMPARE', 'SURVEY', 'OTHER');

-- CreateEnum
CREATE TYPE "lead_status" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED_WON', 'CLOSED_LOST');

-- CreateEnum
CREATE TYPE "chat_sender" AS ENUM ('USER', 'BOT', 'AGENT');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'BUYER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "property_type" NOT NULL,
    "deal" "deal_type" NOT NULL,
    "status" "listing_status" NOT NULL DEFAULT 'PUBLISHED',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "price" BIGINT NOT NULL,
    "was_price" BIGINT,
    "price_unit" TEXT NOT NULL DEFAULT '',
    "land_area" INTEGER,
    "building_area" INTEGER,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "bedrooms_label" TEXT,
    "bathrooms_label" TEXT,
    "floors" INTEGER,
    "unit_type" TEXT,
    "outside_bathrooms" INTEGER,
    "facing" TEXT,
    "roadside" BOOLEAN,
    "description" TEXT[],
    "highlights" TEXT[],
    "certificate" "certificate",
    "payment_method" "payment_method",
    "build_status" "build_status",
    "renovated" BOOLEAN NOT NULL DEFAULT false,
    "ipl_mode" "ipl_mode",
    "ipl_amount" TEXT,
    "ipl_free_years" INTEGER,
    "spaces" TEXT[],
    "security" TEXT[],
    "facilities" TEXT[],
    "distance_toll" TEXT,
    "distance_city" TEXT,
    "distance_health" TEXT,
    "distance_airport" TEXT,
    "walkability" INTEGER,
    "legal_verification" "legal_verification",
    "pbb_status" TEXT,
    "imb_status" TEXT,
    "is_new_project" BOOLEAN NOT NULL DEFAULT false,
    "developer_note" TEXT,
    "agent_id" INTEGER,
    "owner_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_photos" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "property_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "titip_submissions" (
    "id" SERIAL NOT NULL,
    "ref_code" TEXT NOT NULL,
    "stage" "submission_stage" NOT NULL DEFAULT 'REVIEW',
    "review_note" TEXT,
    "user_id" INTEGER,
    "contact_name" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "contact_email" TEXT,
    "submitter_role" "submitter_role" NOT NULL DEFAULT 'PEMILIK',
    "power_of_attorney_file" TEXT,
    "type" "property_type" NOT NULL,
    "deal" "deal_type" NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "price" BIGINT NOT NULL,
    "was_price" BIGINT,
    "land_area" INTEGER,
    "building_area" INTEGER,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "outside_bathrooms" INTEGER,
    "unit_type" TEXT,
    "roadside" BOOLEAN,
    "floors" INTEGER,
    "facing" TEXT,
    "build_status" "build_status",
    "renovated" BOOLEAN,
    "renovated_parts" TEXT[],
    "renovation_note" TEXT,
    "payment_method" "payment_method",
    "ipl_mode" "ipl_mode",
    "ipl_amount" TEXT,
    "ipl_free_years" INTEGER,
    "certificate" "certificate",
    "description" TEXT,
    "spaces" TEXT[],
    "security" TEXT[],
    "facilities" TEXT[],
    "distance_toll" TEXT,
    "distance_city" TEXT,
    "distance_health" TEXT,
    "distance_airport" TEXT,
    "walkability" INTEGER,
    "pbb_status" TEXT,
    "imb_status" TEXT,
    "is_new_project" BOOLEAN,
    "developer_note" TEXT,
    "photos" TEXT[],
    "documents" JSONB NOT NULL DEFAULT '{}',
    "plan" TEXT NOT NULL DEFAULT 'open',
    "agreed_at" TIMESTAMP(3),
    "property_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "titip_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_stage_logs" (
    "id" SERIAL NOT NULL,
    "submission_id" INTEGER NOT NULL,
    "stage" "submission_stage" NOT NULL,
    "note" TEXT,
    "actor" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_stage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notaries" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "hours" TEXT,
    "map_url" TEXT,

    CONSTRAINT "notaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownerships" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "property_id" INTEGER,
    "notary_id" INTEGER,
    "title" TEXT NOT NULL,
    "unit_code" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "cover_url" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status_text" TEXT,
    "purchased_at" DATE,
    "handover_estimate" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "construction_steps" (
    "id" SERIAL NOT NULL,
    "ownership_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "date_label" TEXT NOT NULL,
    "state" "step_state" NOT NULL DEFAULT 'NEXT',
    "percent" INTEGER,
    "note" TEXT,

    CONSTRAINT "construction_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "construction_photos" (
    "id" SERIAL NOT NULL,
    "step_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "taken_at" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "construction_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_steps" (
    "id" SERIAL NOT NULL,
    "ownership_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "date_label" TEXT NOT NULL,
    "state" "step_state" NOT NULL DEFAULT 'NEXT',
    "percent" INTEGER,
    "note" TEXT,
    "document_ref" TEXT,

    CONSTRAINT "legal_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "message" TEXT,
    "source" "lead_source" NOT NULL DEFAULT 'OTHER',
    "status" "lead_status" NOT NULL DEFAULT 'NEW',
    "property_id" INTEGER,
    "agent_id" INTEGER,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" SERIAL NOT NULL,
    "session_id" TEXT NOT NULL,
    "sender" "chat_sender" NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "properties_slug_key" ON "properties"("slug");

-- CreateIndex
CREATE INDEX "properties_type_deal_status_idx" ON "properties"("type", "deal", "status");

-- CreateIndex
CREATE INDEX "properties_city_idx" ON "properties"("city");

-- CreateIndex
CREATE INDEX "properties_price_idx" ON "properties"("price");

-- CreateIndex
CREATE INDEX "property_photos_property_id_sort_order_idx" ON "property_photos"("property_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "titip_submissions_ref_code_key" ON "titip_submissions"("ref_code");

-- CreateIndex
CREATE UNIQUE INDEX "titip_submissions_property_id_key" ON "titip_submissions"("property_id");

-- CreateIndex
CREATE INDEX "titip_submissions_stage_idx" ON "titip_submissions"("stage");

-- CreateIndex
CREATE INDEX "submission_stage_logs_submission_id_created_at_idx" ON "submission_stage_logs"("submission_id", "created_at");

-- CreateIndex
CREATE INDEX "ownerships_user_id_idx" ON "ownerships"("user_id");

-- CreateIndex
CREATE INDEX "construction_steps_ownership_id_sort_order_idx" ON "construction_steps"("ownership_id", "sort_order");

-- CreateIndex
CREATE INDEX "legal_steps_ownership_id_sort_order_idx" ON "legal_steps"("ownership_id", "sort_order");

-- CreateIndex
CREATE INDEX "leads_status_created_at_idx" ON "leads"("status", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_session_id_created_at_idx" ON "chat_messages"("session_id", "created_at");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_photos" ADD CONSTRAINT "property_photos_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "titip_submissions" ADD CONSTRAINT "titip_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "titip_submissions" ADD CONSTRAINT "titip_submissions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_stage_logs" ADD CONSTRAINT "submission_stage_logs_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "titip_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownerships" ADD CONSTRAINT "ownerships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownerships" ADD CONSTRAINT "ownerships_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownerships" ADD CONSTRAINT "ownerships_notary_id_fkey" FOREIGN KEY ("notary_id") REFERENCES "notaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "construction_steps" ADD CONSTRAINT "construction_steps_ownership_id_fkey" FOREIGN KEY ("ownership_id") REFERENCES "ownerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "construction_photos" ADD CONSTRAINT "construction_photos_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "construction_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_steps" ADD CONSTRAINT "legal_steps_ownership_id_fkey" FOREIGN KEY ("ownership_id") REFERENCES "ownerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
