import express, { type Express } from "express";
import { createServer } from "http";
import cors from "cors";
import { Server } from "socket.io";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { initSockets } from "./sockets/index.js";

const app: Express = express();

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map(o => o.trim())
  : true;

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", router);
app.get("/db-migrate", async (req, res) => {
  const { runMigrations } = await import("./lib/migrate.js");
  try {
    await runMigrations(logger);
    res.json({ message: "Migração executada com sucesso!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

export const httpServer = createServer(app);

export const io = new Server(httpServer, {
  path: "/api/socket.io",
  cors: { origin: allowedOrigins === true ? "*" : allowedOrigins, credentials: true },
  transports: ["websocket", "polling"],
});

initSockets(io, logger);

export default app;
