import { Router, type IRouter } from "express";
import healthRouter from "./health";
import generateRepliesRouter from "./generateReplies";
import generateInstagramRouter from "./generateInstagram";
import uploadMediaRouter from "./uploadMedia";

const router: IRouter = Router();

router.use(healthRouter);
router.use(generateRepliesRouter);
router.use(generateInstagramRouter);
router.use(uploadMediaRouter);

export default router;
