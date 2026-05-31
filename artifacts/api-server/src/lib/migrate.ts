import { pool } from "@workspace/db";
import type { Logger } from "pino";

const SQL = `
-- Criar tabelas caso não existam
CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "phone" varchar(20) NOT NULL,
  "password_hash" text NOT NULL,
  "role" text NOT NULL DEFAULT 'passenger',
  "is_approved" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "rides" (
  "id" text PRIMARY KEY,
  "passenger_id" integer REFERENCES "users"("id"),
  "driver_id" integer REFERENCES "users"("id"),
  "origin_address" text NOT NULL,
  "origin_lat" real NOT NULL,
  "origin_lng" real NOT NULL,
  "destination_address" text NOT NULL,
  "destination_lat" real NOT NULL,
  "destination_lng" real NOT NULL,
  "status" text NOT NULL DEFAULT 'finding',
  "ride_type" text NOT NULL,
  "price" real NOT NULL,
  "distance" text,
  "duration" text,
  "pin" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "completed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "ratings" (
  "id" serial PRIMARY KEY,
  "ride_id" text REFERENCES "rides"("id"),
  "rated_id" integer REFERENCES "users"("id"),
  "rater_id" integer REFERENCES "users"("id"),
  "stars" integer NOT NULL,
  "comment" text,
  "role" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "token" text NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" serial PRIMARY KEY,
  "sender_id" text NOT NULL,
  "sender_name" text NOT NULL,
  "receiver_id" text,
  "message" text NOT NULL,
  "timestamp" timestamp DEFAULT now(),
  "ride_id" text
);

CREATE TABLE IF NOT EXISTS "promo_codes" (
  "id" serial PRIMARY KEY,
  "code" text NOT NULL UNIQUE,
  "description" text,
  "discount_type" text NOT NULL DEFAULT 'fixed',
  "discount_value" real NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "max_uses" integer,
  "used_count" integer NOT NULL DEFAULT 0,
  "expires_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Colunas existentes (idempotente)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rg_status" text NOT NULL DEFAULT 'pending';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cnh_status" text NOT NULL DEFAULT 'pending';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "crlv_status" text NOT NULL DEFAULT 'pending';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rg_url" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cnh_url" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "crlv_url" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vehicle_plate" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vehicle_model" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vehicle_year" integer;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vehicle_type" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vehicle_color" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_photo_url" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "driver_rating" real NOT NULL DEFAULT 5.0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passenger_rating" real NOT NULL DEFAULT 5.0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "total_rides" integer NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_active" boolean NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_expires_at" timestamp;

-- NOVAS colunas
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended" boolean NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cancellation_fee_owed" real NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "expo_push_token" text;

-- Renomear dest_* → destination_* (idempotente e seguro)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rides' AND column_name='dest_address') THEN
        ALTER TABLE "rides" ADD COLUMN IF NOT EXISTS "destination_address" text;
        UPDATE "rides" SET "destination_address" = "dest_address" WHERE "destination_address" IS NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rides' AND column_name='dest_lat') THEN
        ALTER TABLE "rides" ADD COLUMN IF NOT EXISTS "destination_lat" real;
        UPDATE "rides" SET "destination_lat" = "dest_lat" WHERE "destination_lat" IS NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rides' AND column_name='dest_lng') THEN
        ALTER TABLE "rides" ADD COLUMN IF NOT EXISTS "destination_lng" real;
        UPDATE "rides" SET "destination_lng" = "dest_lng" WHERE "destination_lng" IS NULL;
    END IF;
END $$;

ALTER TABLE "rides" ADD COLUMN IF NOT EXISTS "arrived_at" timestamp;
ALTER TABLE "rides" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp;
ALTER TABLE "rides" ADD COLUMN IF NOT EXISTS "cancelled_late" boolean NOT NULL DEFAULT false;
ALTER TABLE "rides" ADD COLUMN IF NOT EXISTS "wait_time_fee" real NOT NULL DEFAULT 0;
ALTER TABLE "rides" ADD COLUMN IF NOT EXISTS "promo_code" text;
ALTER TABLE "rides" ADD COLUMN IF NOT EXISTS "promo_discount" real NOT NULL DEFAULT 0;

-- Recalcular métricas reais
UPDATE "users"
SET "total_rides" = COALESCE((
  SELECT COUNT(*)::int FROM "rides"
  WHERE "rides"."driver_id" = "users"."id" AND "rides"."status" = 'completed'
), 0)
WHERE "role" = 'driver';

UPDATE "users"
SET "driver_rating" = COALESCE((
  SELECT ROUND(AVG(stars)::numeric, 2)
  FROM "ratings" WHERE "ratings"."rated_id" = "users"."id" AND "ratings"."role" = 'passenger'
), 5.0)
WHERE "role" = 'driver';

UPDATE "users"
SET "passenger_rating" = COALESCE((
  SELECT ROUND(AVG(stars)::numeric, 2)
  FROM "ratings" WHERE "ratings"."rated_id" = "users"."id" AND "ratings"."role" = 'driver'
), 5.0)
WHERE "role" = 'passenger' OR "role" = 'driver';
`;

export async function runMigrations(logger: Logger): Promise<void> {
  logger.info("Running database migrations...");
  const client = await pool.connect();
  try {
    logger.info("Executing SQL Migration...");
    await client.query(SQL);
    logger.info("Database migrations completed successfully");
  } finally {
    client.release();
  }
}