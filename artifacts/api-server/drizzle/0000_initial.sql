-- SaquaDrive — initial schema
  -- Generated 2026-05-17

  CREATE TABLE IF NOT EXISTS "users" (
    "id" serial PRIMARY KEY,
    "name" text NOT NULL,
    "email" text NOT NULL UNIQUE,
    "phone" varchar(20) NOT NULL,
    "password_hash" text NOT NULL,
    "role" text NOT NULL DEFAULT 'passenger',
    "is_approved" boolean NOT NULL DEFAULT false,
    "rg_status" text NOT NULL DEFAULT 'pending',
    "cnh_status" text NOT NULL DEFAULT 'pending',
    "crlv_status" text NOT NULL DEFAULT 'pending',
    "rg_url" text,
    "cnh_url" text,
    "crlv_url" text,
    "vehicle_plate" text,
    "vehicle_model" text,
    "vehicle_year" integer,
    "vehicle_type" text,
    "profile_photo_url" text,
    "driver_rating" real NOT NULL DEFAULT 5.0,
    "passenger_rating" real NOT NULL DEFAULT 5.0,
    "total_rides" integer NOT NULL DEFAULT 0,
    "subscription_active" boolean NOT NULL DEFAULT false,
    "subscription_expires_at" timestamp,
    "created_at" timestamp NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS "rides" (
    "id" text PRIMARY KEY,
    "passenger_id" integer REFERENCES "users"("id"),
    "driver_id" integer REFERENCES "users"("id"),
    "origin_address" text NOT NULL,
    "origin_lat" real NOT NULL,
    "origin_lng" real NOT NULL,
    "dest_address" text NOT NULL,
    "dest_lat" real NOT NULL,
    "dest_lng" real NOT NULL,
    "status" text NOT NULL DEFAULT 'completed',
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
  