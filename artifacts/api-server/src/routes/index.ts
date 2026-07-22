import { Router, type IRouter } from "express";
import healthRouter from "./health";
import transcribeRouter from "./transcribe";
import storageRouter from "./storage";
import profilePhotoRouter from "./profilePhoto";

const router: IRouter = Router();

router.use(healthRouter);
router.use(transcribeRouter);
router.use(storageRouter);
router.use(profilePhotoRouter);

export default router;
