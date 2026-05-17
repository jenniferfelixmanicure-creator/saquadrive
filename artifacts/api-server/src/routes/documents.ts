import { Router } from "express";
import multer from "multer";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

type DocField = "rgUrl" | "cnhUrl" | "crlvUrl" | "profilePhotoUrl";

async function uploadToCloud(buffer: Buffer, filename: string): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    const { v2: cloudinary } = await import("cloudinary");
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { public_id: filename, resource_type: "image" },
        (err: Error | undefined, result: { secure_url: string } | undefined) => {
          if (err || !result) reject(err ?? new Error("Upload failed"));
          else resolve(result);
        }
      ).end(buffer);
    });
    return result.secure_url;
  }

  return `https://placehold.co/600x400?text=${encodeURIComponent(filename)}`;
}

const DOC_ENDPOINTS: Record<string, { field: DocField; statusField?: keyof typeof usersTable.$inferInsert; label: string }> = {
  "upload-rg": { field: "rgUrl", statusField: "rgStatus", label: "rg" },
  "upload-cnh": { field: "cnhUrl", statusField: "cnhStatus", label: "cnh" },
  "upload-crlv": { field: "crlvUrl", statusField: "crlvStatus", label: "crlv" },
  "upload-profile-photo": { field: "profilePhotoUrl", label: "profile" },
};

for (const [endpoint, config] of Object.entries(DOC_ENDPOINTS)) {
  router.post(
    `/documents/${endpoint}`,
    authenticate,
    upload.single("file"),
    async (req: AuthRequest, res) => {
      try {
        if (!req.file) { res.status(400).json({ message: "Arquivo não enviado" }); return; }
        const userId = req.user!.userId;
        const filename = `${config.label}_${userId}_${Date.now()}`;
        const url = await uploadToCloud(req.file.buffer, filename);
        const updates: Partial<typeof usersTable.$inferInsert> = { [config.field]: url };
        if (config.statusField) updates[config.statusField as keyof typeof usersTable.$inferInsert] = "pending" as never;
        await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));
        res.json({ url, message: "Documento enviado com sucesso" });
      } catch (err) {
        req.log.error(err);
        res.status(500).json({ message: "Erro ao enviar documento" });
      }
    }
  );
}

export default router;
