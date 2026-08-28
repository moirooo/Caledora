import { Router, type IRouter } from "express";
import healthRouter from "./health";
import generateRepliesRouter from "./generateReplies";
import generateInstagramRouter from "./generateInstagram";
import aiRouter from "./ai";
import uploadMediaRouter from "./uploadMedia";
import stateRouter from "./state";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(generateRepliesRouter);
router.use(generateInstagramRouter);
router.use(aiRouter);
router.use(uploadMediaRouter);
router.use(stateRouter);
router.use(storageRouter);

export default router;
