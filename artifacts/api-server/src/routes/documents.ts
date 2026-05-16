import { Router } from "express";
import type { Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import { logger } from "../lib/logger.js";
import { db } from "@workspace/db";
import { usersTable, driversTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import type { AuthRequest } from "../middlewares/auth.js";
import multer from "multer";
import { Readable } from "node:stream";

const router = Router();

// Configurar Cloudinary com as variáveis de ambiente do Render
cloudinary.config({
  cloud_name: process.env["CLOUDINARY_CLOUD_NAME"],
  api_key: process.env["CLOUDINARY_API_KEY"],
  api_secret: process.env["CLOUDINARY_API_SECRET"],
  secure: true,
});

// Multer com memória — o buffer vai direto para o Cloudinary (sem /tmp)
const uploadDocs = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formato não permitido. Use JPG, PNG, WebP ou PDF."));
    }
  },
});

const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formato não permitido. Use JPG, PNG ou WebP."));
    }
  },
});

type MulterRequest = AuthRequest & {
  file?: Express.Multer.File;
};

/** Envia o buffer em memória para o Cloudinary e retorna a URL segura */
function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  resourceType: "image" | "raw" = "image",
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `saquadrive/${folder}`, resource_type: resourceType },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Upload falhou sem erro explícito"));
        } else {
          resolve(result.secure_url);
        }
      },
    );
    Readable.from(buffer).pipe(stream);
  });
}

// POST /api/documents/upload-profile-photo
router.post(
  "/documents/upload-profile-photo",
  requireAuth,
  uploadImages.single("photo"),
  async (req: MulterRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ message: "Nenhuma foto enviada." });
      return;
    }
    try {
      const profilePhotoUrl = await uploadToCloudinary(req.file.buffer, "profile-photos", "image");
      await db
        .update(usersTable)
        .set({ profilePhotoUrl, updatedAt: new Date() })
        .where(eq(usersTable.id, req.userId!));
      logger.info({ userId: req.userId }, "Foto de perfil atualizada (Cloudinary)");
      res.json({ message: "Foto de perfil atualizada com sucesso.", profilePhotoUrl });
    } catch (error) {
      logger.error({ error }, "Erro upload foto de perfil para Cloudinary");
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  },
);

// POST /api/documents/upload-rg
router.post(
  "/documents/upload-rg",
  requireAuth,
  uploadDocs.single("rg"),
  async (req: MulterRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ message: "Nenhum arquivo RG enviado." });
      return;
    }
    try {
      const isPdf = req.file.mimetype === "application/pdf";
      const rgUrl = await uploadToCloudinary(req.file.buffer, "rg-docs", isPdf ? "raw" : "image");
      await db
        .update(usersTable)
        .set({ rgStatus: "pending", rgUrl, updatedAt: new Date() })
        .where(eq(usersTable.id, req.userId!));
      logger.info({ userId: req.userId }, "RG enviado para Cloudinary");
      res.json({ message: "RG enviado para análise. Aguarde aprovação.", rgUrl });
    } catch (error) {
      logger.error({ error }, "Erro upload RG para Cloudinary");
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  },
);

// POST /api/documents/upload-cnh
router.post(
  "/documents/upload-cnh",
  requireAuth,
  uploadDocs.single("cnh"),
  async (req: MulterRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ message: "Nenhum arquivo CNH enviado." });
      return;
    }
    try {
      const isPdf = req.file.mimetype === "application/pdf";
      const cnhUrl = await uploadToCloudinary(req.file.buffer, "cnh-docs", isPdf ? "raw" : "image");
      await db
        .update(driversTable)
        .set({ cnhStatus: "pending", cnhUrl, updatedAt: new Date() })
        .where(eq(driversTable.userId, req.userId!));
      logger.info({ userId: req.userId }, "CNH enviada para Cloudinary");
      res.json({ message: "CNH enviada para análise. Aguarde aprovação.", cnhUrl });
    } catch (error) {
      logger.error({ error }, "Erro upload CNH para Cloudinary");
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  },
);

// POST /api/documents/upload-crlv
router.post(
  "/documents/upload-crlv",
  requireAuth,
  uploadDocs.single("crlv"),
  async (req: MulterRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ message: "Nenhum arquivo CRLV enviado." });
      return;
    }
    try {
      const isPdf = req.file.mimetype === "application/pdf";
      const crlvUrl = await uploadToCloudinary(req.file.buffer, "crlv-docs", isPdf ? "raw" : "image");
      await db
        .update(driversTable)
        .set({ crlvStatus: "pending", crlvUrl, updatedAt: new Date() })
        .where(eq(driversTable.userId, req.userId!));
      logger.info({ userId: req.userId }, "CRLV enviado para Cloudinary");
      res.json({ message: "CRLV enviado para análise. Aguarde aprovação.", crlvUrl });
    } catch (error) {
      logger.error({ error }, "Erro upload CRLV para Cloudinary");
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  },
);

export default router;
