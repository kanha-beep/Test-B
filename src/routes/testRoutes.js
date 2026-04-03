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

const router = Router();

router.get("/pdf-files", listPdfFiles);
router.get("/parse-pdf", parsePdfFromFolder);
router.get("/", listTests);
router.post("/generate", optionalAuth, createGeneratedTest);
router.post("/import", optionalAuth, createImportedTest);
router.get("/submissions", optionalAuth, listSubmissions);
router.get("/submissions/:id", optionalAuth, getSubmissionById);
router.get("/:id/rankings", getTestRankings);
router.get("/:id", getTestById);
router.post("/:id/submissions", optionalAuth, submitTest);
router.delete("/:id", requireAuth, requireAdmin, deleteTest);

export default router;
