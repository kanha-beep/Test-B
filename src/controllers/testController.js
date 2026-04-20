// Handle test listing, generation, importing, deletion, and ranking-related HTTP actions.

import { readdir } from "fs/promises";
import { basename, join, resolve } from "path";
import { Submission } from "../models/Submission.js";
import { Test } from "../models/Test.js";
import { generateTestFromPrompt } from "../services/aiService.js";
import { parsePdfFile } from "../services/pdfParserService.js";

const PDF_FOLDER = resolve("pdf");
const SUPPORTED_PAGE_TYPES = new Set(["full-test", "sectional", "pyq", "custom"]);

// Handle the cleanText logic for this module.
function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeDurationMinutes(value, fallback = 30) {
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : fallback;
}

// Handle the sanitizeTags logic for this module.
function sanitizeTags(tags = []) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return [...new Set(tags.map((tag) => cleanText(tag)).filter(Boolean))];
}

// Handle the normalizeExamFilter logic for this module.
function normalizeExamFilter(queryValue) {
  if (!queryValue) {
    return [];
  }

  return String(queryValue).split(",").map((item) => item.trim()).filter(Boolean);
}

// Handle the resolveTestMetadata logic for this module.
function resolveTestMetadata(payload = {}, user = null) {
  const examType = cleanText(payload.examType, "General");
  const pageType = SUPPORTED_PAGE_TYPES.has(payload.pageType) ? payload.pageType : "full-test";
  const explanationMode = payload.explanationMode === "without-explanation" ? "without-explanation" : "with-solution";
  const sectionName = pageType === "sectional" ? cleanText(payload.sectionName) : "";
  return { examType, pageType, explanationMode, sectionName, syllabusTags: sanitizeTags(payload.syllabusTags), createdByName: cleanText(user?.displayName, "System"), ownerUserId: user?._id || null };
}

// Handle the defaultInstructions logic for this module.
function defaultInstructions(positiveMarks = 2, negativeMarks = -1 / 3) {
  return ["Each question has one correct answer.", `Scoring: +${positiveMarks} for correct answers and ${negativeMarks} for incorrect answers.`, "You can skip questions or mark them for review before submitting."];
}

// Handle the sanitizeImportedQuestion logic for this module.
function sanitizeImportedQuestion(question, index, explanationMode = "with-solution") {
  const optionKeys = ["A", "B", "C", "D"];
  const rawOptions = question.options || [];
  const optionMap = new Map(rawOptions.map((option) => [String(option.key || "").toUpperCase(), { text: String(option.text || "").trim(), explanation: String(option.explanation || "").trim() }]));
  const options = optionKeys.map((key) => {
    const entry = optionMap.get(key) || { text: "", explanation: "" };
    return { key, text: entry.text, explanation: explanationMode === "with-solution" ? entry.explanation : "" };
  });
  return { number: index + 1, prompt: cleanText(question.prompt), subject: cleanText(question.subject, "PDF Import"), difficulty: cleanText(question.difficulty, "Mixed"), options, correctOption: cleanText(question.correctOption).toUpperCase(), explanation: explanationMode === "with-solution" ? cleanText(question.explanation) : "" };
}

function isValidQuestion(question) {
  const optionKeys = new Set((question.options || []).map((option) => option.key));
  return (
    question.prompt &&
    ["A", "B", "C", "D"].includes(question.correctOption) &&
    optionKeys.size === 4 &&
    question.options.every((option) => option.text)
  );
}

function sanitizeGeneratedQuestion(question, index, metadata) {
  const optionKeys = ["A", "B", "C", "D"];
  const optionMap = new Map(
    (question.options || []).map((option) => [
      cleanText(option?.key).toUpperCase(),
      {
        text: cleanText(option?.text),
        explanation: cleanText(option?.explanation)
      }
    ])
  );

  return {
    number: index + 1,
    prompt: cleanText(question.prompt),
    subject: cleanText(question.subject, metadata.sectionName || metadata.examType || "General"),
    difficulty: cleanText(question.difficulty, "Mixed"),
    options: optionKeys.map((key) => {
      const entry = optionMap.get(key) || { text: "", explanation: "" };
      return { key, text: entry.text, explanation: entry.explanation };
    }),
    correctOption: cleanText(question.correctOption).toUpperCase(),
    explanation: cleanText(question.explanation, "Generated from prompt.")
  };
}

// Handle the mapTestListItem logic for this module.
function mapTestListItem(test) {
  return { _id: test._id, title: test.title, description: test.description, sourceType: test.sourceType, examType: test.examType || "General", pageType: test.pageType || "full-test", explanationMode: test.explanationMode || "with-solution", sectionName: test.sectionName || "", syllabusTags: test.syllabusTags || [], createdByName: test.createdByName || "System", ownerUserId: test.ownerUserId || null, durationMinutes: test.durationMinutes, positiveMarks: test.positiveMarks, negativeMarks: test.negativeMarks, totalMarks: test.totalMarks, totalQuestions: test.questions.length, instructions: test.instructions, createdAt: test.createdAt };
}

// Handle the listPdfFiles logic for this module.
export async function listPdfFiles(_request, response) { try { const files = await readdir(PDF_FOLDER); response.json(files.filter((file) => file.toLowerCase().endsWith(".pdf"))); } catch { response.json([]); } }
// Parse a selected server-side PDF file into question data.
export async function parsePdfFromFolder(request, response) { const filename = cleanText(request.query.filename); const safeFilename = basename(filename); if (!safeFilename || safeFilename !== filename || !safeFilename.toLowerCase().endsWith(".pdf")) return response.status(400).json({ message: "Invalid filename" }); try { const result = await parsePdfFile(join(PDF_FOLDER, safeFilename)); return response.json({ title: safeFilename.replace(/\.pdf$/i, ""), ...result }); } catch (error) { return response.status(500).json({ message: error.message || "Failed to parse PDF" }); } }
// Handle the listTests logic for this module.
export async function listTests(request, response) { const filter = {}; const examTypes = normalizeExamFilter(request.query.examType); const pageType = cleanText(request.query.pageType); if (examTypes.length === 1) filter.examType = examTypes[0]; else if (examTypes.length > 1) filter.examType = { $in: examTypes }; if (pageType && SUPPORTED_PAGE_TYPES.has(pageType)) filter.pageType = pageType; const tests = await Test.find(filter).sort({ createdAt: -1 }).select("title description sourceType examType pageType explanationMode sectionName syllabusTags createdByName ownerUserId durationMinutes positiveMarks negativeMarks totalMarks questions instructions createdAt").lean(); response.json(tests.map(mapTestListItem)); }
// Handle the createGeneratedTest logic for this module.
export async function createGeneratedTest(request, response) { const prompt = request.body?.prompt?.trim(); if (!prompt) return response.status(400).json({ message: "Prompt is required" }); try { const generated = await generateTestFromPrompt(prompt); const positiveMarks = 2; const negativeMarks = -1 / 3; const metadata = resolveTestMetadata(request.body, request.user); const questions = Array.isArray(generated.questions) ? generated.questions.map((question, index) => sanitizeGeneratedQuestion(question, index, metadata)) : []; if (!cleanText(generated.title) || questions.length === 0 || questions.some((question) => !isValidQuestion(question))) return response.status(502).json({ message: "Generated test content was incomplete. Please try again." }); const test = await Test.create({ title: cleanText(generated.title, "Generated Test"), description: cleanText(generated.description, "Generated from prompt."), sourceType: "prompt", ...metadata, durationMinutes: normalizeDurationMinutes(generated.durationMinutes), positiveMarks, negativeMarks, totalMarks: questions.length * positiveMarks, instructions: generated.instructions?.length ? generated.instructions : defaultInstructions(positiveMarks, negativeMarks), questions }); return response.status(201).json(mapTestListItem(test)); } catch (error) { return response.status(502).json({ message: error.message || "Failed to generate test" }); } }
// Handle the createImportedTest logic for this module.
export async function createImportedTest(request, response) { const title = request.body?.title?.trim(); const description = request.body?.description?.trim() || "Imported from uploaded PDF."; const durationMinutes = normalizeDurationMinutes(request.body?.durationMinutes); const incomingQuestions = Array.isArray(request.body?.questions) ? request.body.questions : []; if (!title) return response.status(400).json({ message: "Title is required" }); if (incomingQuestions.length === 0) return response.status(400).json({ message: "At least one question is required" }); const metadata = resolveTestMetadata(request.body, request.user); const questions = incomingQuestions.map((question, index) => sanitizeImportedQuestion(question, index, metadata.explanationMode)); const invalidQuestion = questions.find((question) => !isValidQuestion(question)); if (invalidQuestion) return response.status(400).json({ message: "Each question must have text, four options, and a valid correct option" }); const positiveMarks = 2; const negativeMarks = -1 / 3; const test = await Test.create({ title, description, sourceType: "pdf", ...metadata, durationMinutes, positiveMarks, negativeMarks, totalMarks: questions.length * positiveMarks, instructions: defaultInstructions(positiveMarks, negativeMarks), questions: questions.map((question) => ({ ...question, subject: question.subject || metadata.sectionName || metadata.examType || "PDF Import" })) }); return response.status(201).json(mapTestListItem(test)); }
// Return one saved test by id for starting or reviewing it.
export async function getTestById(request, response) { const test = await Test.findById(request.params.id).lean(); if (!test) return response.status(404).json({ message: "Test not found" }); return response.json({ _id: test._id, title: test.title, description: test.description, sourceType: test.sourceType, examType: test.examType || "General", pageType: test.pageType || "full-test", explanationMode: test.explanationMode || "with-solution", sectionName: test.sectionName || "", syllabusTags: test.syllabusTags || [], createdByName: test.createdByName || "System", durationMinutes: test.durationMinutes, positiveMarks: test.positiveMarks, negativeMarks: test.negativeMarks, totalMarks: test.totalMarks, totalQuestions: test.questions.length, instructions: test.instructions, questions: test.questions.map((question) => ({ _id: question._id, number: question.number, prompt: question.prompt, subject: question.subject, difficulty: question.difficulty, options: (question.options || []).map((option) => ({ key: option.key, text: option.text })) })) }); }
// Remove a saved test and its linked submissions when allowed.
export async function deleteTest(request, response) { const deleted = await Test.findByIdAndDelete(request.params.id).lean(); if (!deleted) return response.status(404).json({ message: "Test not found" }); await Submission.deleteMany({ testId: request.params.id }); return response.json({ ok: true, deletedId: deleted._id }); }
