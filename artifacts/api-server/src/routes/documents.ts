import { Router } from "express";
import type { Response } from "express";
import fs from "fs";
import os from "os";
import path from "path";
import { logger } from "../lib/logger.js";
import { db } from "@workspace/db";
import { usersTable, driversTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import type { AuthRequest } from "../middlewares/auth.js";

import multer from "multer";

const router = Router();

export const UPLOAD_DIR = process.env["UPLOAD_DIR"] ?? path.join(os.tmpdir(), "saquadrive-uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req: unknown, _file: unknown, cb: (e: null, d: string) => void) =>
      cb(null, UPLOAD_DIR),
    filename: (_req: unknown, file: { fieldname: string; originalname: string }, cb: (e: null, n: string) => void) =>
      cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: { mimetype: string }, cb: (e: null | Error, accept: boolean) => void) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formato não permitido. Use JPG, PNG, WebP ou PDF."), false);
    }
  },
});

const uploadImageOnly = multer({
  storage: multer.diskStorage({
    destination: (_req: unknown, _file: unknown, cb: (e: null, d: string) => void) =>
      cb(null, UPLOAD_DIR),
    filename: (_req: unknown, file: { fieldname: string; originalname: string }, cb: (e: null, n: string) => void) =>
      cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: { mimetype: string }, cb: (e: null | Error, accept: boolean) => void) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formato não permitido. Use JPG, PNG ou WebP."), false);
    }
  },
});

type MulterRequest = AuthRequest & { file?: { filename: string; fieldname: string; originalname: string } };

// POST /api/documents/upload-profile-photo
router.post("/documents/upload-profile-photo", requireAuth, uploadImageOnly.single("photo"), async (req: MulterRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: "Nenhuma foto enviada." });
    return;
  }
  try {
    const profilePhotoUrl = `/uploads/${req.file.filename}`;
    await db.update(usersTable)
      .set({ profilePhotoUrl, updatedAt: new Date() })
      .where(eq(usersTable.id, req.userId!));
    logger.info({ userId: req.userId, file: req.file.filename }, "Foto de perfil atualizada");
    res.json({ message: "Foto de perfil atualizada com sucesso.", profilePhotoUrl });
  } catch (error) {
    logger.error({ error }, "Erro upload foto de perfil");
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

// POST /api/documents/upload-rg
router.post("/documents/upload-rg", requireAuth, upload.single("rg"), async (req: MulterRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: "Nenhum arquivo RG enviado." });
    return;
  }
  try {
    const rgUrl = `/uploads/${req.file.filename}`;
    await db.update(usersTable)
      .set({ rgStatus: "pending", rgUrl, updatedAt: new Date() })
      .where(eq(usersTable.id, req.userId!));
    logger.info({ userId: req.userId, file: req.file.filename }, "RG enviado");
    res.json({ message: "RG enviado para análise. Aguarde aprovação.", rgUrl });
  } catch (error) {
    logger.error({ error }, "Erro upload RG");
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

// POST /api/documents/upload-cnh
router.post("/documents/upload-cnh", requireAuth, upload.single("cnh"), async (req: MulterRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: "Nenhum arquivo CNH enviado." });
    return;
  }
  try {
    const cnhUrl = `/uploads/${req.file.filename}`;
    await db.update(driversTable)
      .set({ cnhStatus: "pending", cnhUrl, updatedAt: new Date() })
      .where(eq(driversTable.userId, req.userId!));
    logger.info({ userId: req.userId, file: req.file.filename }, "CNH enviada");
    res.json({ message: "CNH enviada para análise. Aguarde aprovação.", cnhUrl });
  } catch (error) {
    logger.error({ error }, "Erro upload CNH");
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

// POST /api/documents/upload-crlv
router.post("/documents/upload-crlv", requireAuth, upload.single("crlv"), async (req: MulterRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: "Nenhum arquivo CRLV enviado." });
    return;
  }
  try {
    const crlvUrl = `/uploads/${req.file.filename}`;
    await db.update(driversTable)
      .set({ crlvStatus: "pending", crlvUrl, updatedAt: new Date() })
      .where(eq(driversTable.userId, req.userId!));
    logger.info({ userId: req.userId, file: req.file.filename }, "CRLV enviado");
    res.json({ message: "CRLV enviado para análise. Aguarde aprovação.", crlvUrl });
  } catch (error) {
    logger.error({ error }, "Erro upload CRLV");
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

export default router;
