import { Router } from "express";
import { createGeneratedTest, createImportedTest, getTestById, listTests, listPdfFiles, parsePdfFromFolder } from "../controllers/testController.js";
import { getSubmissionById, listSubmissions, submitTest } from "../controllers/submissionController.js";

const router = Router();

router.get("/pdf-files", listPdfFiles);
router.get("/parse-pdf", parsePdfFromFolder);
router.get("/", listTests);
router.post("/generate", createGeneratedTest);
router.post("/import", createImportedTest);
router.get("/submissions", listSubmissions);
router.get("/submissions/:id", getSubmissionById);
router.get("/:id", getTestById);
router.post("/:id/submissions", submitTest);

export default router;
