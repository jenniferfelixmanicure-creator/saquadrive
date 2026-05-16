import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { sql } from "drizzle-orm";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { registerRideSocket } from "./sockets/rideSocket.js";
import { db } from "@workspace/db";
import https from "node:https";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

async function runMigrations() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL,
        password_hash TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'passenger',
        rg_status TEXT DEFAULT 'pending',
        rg_url TEXT,
        is_approved BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'passenger'`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drivers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        cnh_status TEXT DEFAULT 'pending',
        cnh_url TEXT,
        crlv_status TEXT DEFAULT 'pending',
        crlv_url TEXT,
        vehicle_plate TEXT NOT NULL DEFAULT '',
        vehicle_model TEXT NOT NULL DEFAULT '',
        vehicle_year INTEGER,
        vehicle_type TEXT NOT NULL DEFAULT 'car',
        vehicle_color TEXT DEFAULT 'Prata',
        rating NUMERIC(3,2) DEFAULT 5.0,
        total_rides INTEGER DEFAULT 0,
        is_approved BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_color TEXT DEFAULT 'Prata'`);
    await db.execute(sql`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 5.0`);
    await db.execute(sql`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS total_rides INTEGER DEFAULT 0`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rides (
        id TEXT PRIMARY KEY,
        passenger_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        origin_address TEXT NOT NULL,
        origin_lat NUMERIC(10,7) NOT NULL,
        origin_lng NUMERIC(10,7) NOT NULL,
        destination_address TEXT NOT NULL,
        destination_lat NUMERIC(10,7) NOT NULL,
        destination_lng NUMERIC(10,7) NOT NULL,
        ride_type TEXT NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        distance TEXT,
        duration TEXT,
        status TEXT NOT NULL DEFAULT 'finding',
        pin TEXT,
        passenger_rating INTEGER,
        driver_rating INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ratings (
        id SERIAL PRIMARY KEY,
        ride_id TEXT REFERENCES rides(id) ON DELETE CASCADE,
        rater_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        rated_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        stars INTEGER NOT NULL,
        comment TEXT,
        role TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        receiver_id TEXT,
        message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW(),
        ride_id TEXT
      )
    `);
    logger.info("Migrations OK — todas as tabelas criadas/verificadas");
  } catch (err) {
    logger.error({ err }, "Migration falhou");
  }
}

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  path: "/api/socket.io",
  cors: { origin: "*", methods: ["GET", "POST"] },
});

registerRideSocket(io);

httpServer.listen(port, async () => {
  logger.info({ port }, "Server listening");
  await runMigrations();

  // Sistema Keep-Alive para Render (Plano Gratuito)
  const RENDER_EXTERNAL_URL = process.env["RENDER_EXTERNAL_URL"];
  if (RENDER_EXTERNAL_URL) {
    logger.info(`Keep-alive ativado para: ${RENDER_EXTERNAL_URL}`);
    setInterval(() => {
      https.get(`${RENDER_EXTERNAL_URL}/api/healthz`, (res) => {
        logger.info(`Keep-alive ping enviado. Status: ${res.statusCode}`);
      }).on('error', (err) => {
        logger.error(`Erro no keep-alive ping: ${err.message}`);
      });
    }, 14 * 60 * 1000); // Ping a cada 14 minutos (Render dorme após 15)
  }
});

httpServer.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
