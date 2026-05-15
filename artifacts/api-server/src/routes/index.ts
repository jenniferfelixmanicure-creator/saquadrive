import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import documentsRouter from "./documents.js";
import adminRouter from "./admin.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import ridesRouter from "./rides.js";
import ratingsRouter from "./ratings.js";

const router: IRouter = Router();

router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/rides", ridesRouter);
router.use("/ratings", ratingsRouter);
router.use(healthRouter);
router.use(documentsRouter);
router.use("/admin", adminRouter);

export default router;
