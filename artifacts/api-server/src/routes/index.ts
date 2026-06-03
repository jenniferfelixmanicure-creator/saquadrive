import { Router } from "express";
import authRoutes from "./auth.js";
import authNewRoutes from "./auth_new.js";
import userRoutes from "./users.js";
import rideRoutes from "./rides.js";
import ratingRoutes from "./ratings.js";
import adminRoutes from "./admin.js";
import aiRoutes from "./ai.js";
import documentRoutes from "./documents.js";
import healthRoutes from "./health.js";

const router = Router();

router.use(authRoutes);
router.use(authNewRoutes); // Adicionando a nova lógica de recuperação
router.use(userRoutes);
router.use(rideRoutes);
router.use(ratingRoutes);
router.use(adminRoutes);
router.use(aiRoutes);
router.use(documentRoutes);
router.use(healthRoutes);

export default router;
