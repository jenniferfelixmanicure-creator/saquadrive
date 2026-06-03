import { Router } from "express";

import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";

const router = Router();


type DocField = "rgUrl" | "cnhUrl" | "crlvUrl" | "profilePhotoUrl";



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
    async (req: AuthRequest, res) => {
      try {
        const { url } = req.body as { url: string };
        if (!url) { res.status(400).json({ message: "URL do documento não fornecida" }); return; }
        const userId = req.user!.userId;
        const updates: Partial<typeof usersTable.$inferInsert> = { [config.field]: url };
        if (config.statusField) updates[config.statusField as keyof typeof usersTable.$inferInsert] = "pending" as never;
        await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));
        res.json({ url, message: "Documento enviado com sucesso" });
      } catch (err) {
        req.log.error(err);
        res.status(500).json({ message: "Erro ao processar documento" });
      }
    }
  );
}

export default router;
