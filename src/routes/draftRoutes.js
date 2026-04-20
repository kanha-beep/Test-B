// Register API endpoints used to save and restore imported-test drafts.

import { Router } from "express";
import { getLatestDraft, upsertDraft } from "../controllers/draftController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/", requireAuth, asyncHandler(upsertDraft));
router.get("/latest", requireAuth, asyncHandler(getLatestDraft));

export default router;
