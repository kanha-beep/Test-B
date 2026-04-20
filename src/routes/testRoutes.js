// Register test-related API endpoints for list, create, import, rankings, and submission flows.

import { Router } from "express";
import {
  createGeneratedTest,
  createImportedTest,
  deleteTest,
  getTestById,
  listTests,
  listPdfFiles,
  parsePdfFromFolder
} from "../controllers/testController.js";
import {
  getSubmissionById,
  getTestRankings,
  listSubmissions,
  submitTest
} from "../controllers/submissionController.js";
import { optionalAuth, requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/pdf-files", asyncHandler(listPdfFiles));
router.get("/parse-pdf", asyncHandler(parsePdfFromFolder));
router.get("/", asyncHandler(listTests));
router.post("/generate", optionalAuth, asyncHandler(createGeneratedTest));
router.post("/import", requireAuth, asyncHandler(createImportedTest));
router.get("/submissions", optionalAuth, asyncHandler(listSubmissions));
router.get("/submissions/:id", optionalAuth, asyncHandler(getSubmissionById));
router.get("/:id/rankings", optionalAuth, asyncHandler(getTestRankings));
router.get("/:id", asyncHandler(getTestById));
router.post("/:id/submissions", optionalAuth, asyncHandler(submitTest));
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(deleteTest));

export default router;
