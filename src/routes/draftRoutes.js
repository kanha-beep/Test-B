import { Router } from "express";
import { getLatestDraft, upsertDraft } from "../controllers/draftController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/", requireAuth, upsertDraft);
router.get("/latest", requireAuth, getLatestDraft);

export default router;
