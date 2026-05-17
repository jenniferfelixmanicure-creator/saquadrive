import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import ridesRouter from "./rides.js";
import ratingsRouter from "./ratings.js";
import adminRouter from "./admin.js";
import documentsRouter from "./documents.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(ridesRouter);
router.use(ratingsRouter);
router.use(adminRouter);
router.use(documentsRouter);

export default router;
