import { Router, type IRouter } from "express";
import healthRouter from "./health";
import generateRepliesRouter from "./generateReplies";

const router: IRouter = Router();

router.use(healthRouter);
router.use(generateRepliesRouter);

export default router;
