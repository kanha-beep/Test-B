import { readdir } from "fs/promises";
import { join, resolve } from "path";
import { Submission } from "../models/Submission.js";
import { Test } from "../models/Test.js";
import { generateTestFromPrompt } from "../services/aiService.js";
import { parsePdfFile } from "../services/pdfParserService.js";

const PDF_FOLDER = resolve("pdf");
const SUPPORTED_PAGE_TYPES = new Set(["full-test", "sectional", "pyq", "custom"]);

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function sanitizeTags(tags = []) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return [...new Set(tags.map((tag) => cleanText(tag)).filter(Boolean))];
}

function normalizeExamFilter(queryValue) {
  if (!queryValue) {
    return [];
  }

  return String(queryValue).split(",").map((item) => item.trim()).filter(Boolean);
}

function resolveTestMetadata(payload = {}, user = null) {
  const examType = cleanText(payload.examType, "General");
  const pageType = SUPPORTED_PAGE_TYPES.has(payload.pageType) ? payload.pageType : "full-test";
  const sectionName = pageType === "sectional" ? cleanText(payload.sectionName) : "";
  return { examType, pageType, sectionName, syllabusTags: sanitizeTags(payload.syllabusTags), createdByName: cleanText(user?.displayName, "System"), ownerUserId: user?._id || null };
}

function defaultInstructions(positiveMarks = 2, negativeMarks = -1 / 3) {
  return ["Each question has one correct answer.", `Scoring: +${positiveMarks} for correct answers and ${negativeMarks} for incorrect answers.`, "You can skip questions or mark them for review before submitting."];
}

function sanitizeImportedQuestion(question, index) {
  const optionKeys = ["A", "B", "C", "D"];
  const rawOptions = question.options || [];
  const optionMap = new Map(rawOptions.map((option) => [String(option.key || "").toUpperCase(), { text: String(option.text || "").trim(), explanation: String(option.explanation || "").trim() }]));
  const options = optionKeys.map((key) => {
    const entry = optionMap.get(key) || { text: "", explanation: "" };
    return { key, text: entry.text, explanation: entry.explanation };
  });
  return { number: index + 1, prompt: cleanText(question.prompt), subject: cleanText(question.subject, "PDF Import"), difficulty: cleanText(question.difficulty, "Mixed"), options, correctOption: cleanText(question.correctOption).toUpperCase(), explanation: cleanText(question.explanation) };
}

function mapTestListItem(test) {
  return { _id: test._id, title: test.title, description: test.description, sourceType: test.sourceType, examType: test.examType || "General", pageType: test.pageType || "full-test", sectionName: test.sectionName || "", syllabusTags: test.syllabusTags || [], createdByName: test.createdByName || "System", ownerUserId: test.ownerUserId || null, durationMinutes: test.durationMinutes, positiveMarks: test.positiveMarks, negativeMarks: test.negativeMarks, totalMarks: test.totalMarks, totalQuestions: test.questions.length, instructions: test.instructions, createdAt: test.createdAt };
}

export async function listPdfFiles(_request, response) { try { const files = await readdir(PDF_FOLDER); response.json(files.filter((file) => file.toLowerCase().endsWith(".pdf"))); } catch { response.json([]); } }
export async function parsePdfFromFolder(request, response) { const filename = request.query.filename?.trim(); if (!filename || filename.includes("..")) return response.status(400).json({ message: "Invalid filename" }); try { const result = await parsePdfFile(join(PDF_FOLDER, filename)); return response.json({ title: filename.replace(/\.pdf$/i, ""), ...result }); } catch (error) { return response.status(500).json({ message: error.message || "Failed to parse PDF" }); } }
export async function listTests(request, response) { const filter = {}; const examTypes = normalizeExamFilter(request.query.examType); const pageType = cleanText(request.query.pageType); if (examTypes.length === 1) filter.examType = examTypes[0]; else if (examTypes.length > 1) filter.examType = { $in: examTypes }; if (pageType && SUPPORTED_PAGE_TYPES.has(pageType)) filter.pageType = pageType; const tests = await Test.find(filter).sort({ createdAt: -1 }).select("title description sourceType examType pageType sectionName syllabusTags createdByName ownerUserId durationMinutes positiveMarks negativeMarks totalMarks questions instructions createdAt").lean(); response.json(tests.map(mapTestListItem)); }
export async function createGeneratedTest(request, response) { const prompt = request.body?.prompt?.trim(); if (!prompt) return response.status(400).json({ message: "Prompt is required" }); try { const generated = await generateTestFromPrompt(prompt); const positiveMarks = 2; const negativeMarks = -1 / 3; const metadata = resolveTestMetadata(request.body, request.user); const test = await Test.create({ title: generated.title, description: generated.description, sourceType: "prompt", ...metadata, durationMinutes: generated.durationMinutes, positiveMarks, negativeMarks, totalMarks: generated.questions.length * positiveMarks, instructions: generated.instructions?.length ? generated.instructions : defaultInstructions(positiveMarks, negativeMarks), questions: generated.questions.map((question, index) => ({ number: index + 1, prompt: question.prompt, subject: question.subject || metadata.sectionName || metadata.examType || "General", difficulty: question.difficulty || "Mixed", options: (question.options || []).map((option) => ({ key: option.key, text: option.text, explanation: String(option.explanation || "").trim() })), correctOption: question.correctOption, explanation: question.explanation || "Generated from prompt." })) }); return response.status(201).json(mapTestListItem(test)); } catch (error) { return response.status(502).json({ message: error.message || "Failed to generate test" }); } }
export async function createImportedTest(request, response) { const title = request.body?.title?.trim(); const description = request.body?.description?.trim() || "Imported from uploaded PDF."; const durationMinutes = Number(request.body?.durationMinutes || 30); const incomingQuestions = Array.isArray(request.body?.questions) ? request.body.questions : []; if (!title) return response.status(400).json({ message: "Title is required" }); if (incomingQuestions.length === 0) return response.status(400).json({ message: "At least one question is required" }); const questions = incomingQuestions.map(sanitizeImportedQuestion); const invalidQuestion = questions.find((question) => !question.prompt || !question.correctOption || question.options.some((option) => !option.text)); if (invalidQuestion) return response.status(400).json({ message: "Each question must have text, four options, and a correct option" }); const positiveMarks = 2; const negativeMarks = -1 / 3; const metadata = resolveTestMetadata(request.body, request.user); const test = await Test.create({ title, description, sourceType: "pdf", ...metadata, durationMinutes, positiveMarks, negativeMarks, totalMarks: questions.length * positiveMarks, instructions: defaultInstructions(positiveMarks, negativeMarks), questions: questions.map((question) => ({ ...question, subject: question.subject || metadata.sectionName || metadata.examType || "PDF Import" })) }); return response.status(201).json(mapTestListItem(test)); }
export async function getTestById(request, response) { const test = await Test.findById(request.params.id).lean(); if (!test) return response.status(404).json({ message: "Test not found" }); return response.json({ _id: test._id, title: test.title, description: test.description, sourceType: test.sourceType, examType: test.examType || "General", pageType: test.pageType || "full-test", sectionName: test.sectionName || "", syllabusTags: test.syllabusTags || [], createdByName: test.createdByName || "System", durationMinutes: test.durationMinutes, positiveMarks: test.positiveMarks, negativeMarks: test.negativeMarks, totalMarks: test.totalMarks, totalQuestions: test.questions.length, instructions: test.instructions, questions: test.questions.map((question) => ({ _id: question._id, number: question.number, prompt: question.prompt, subject: question.subject, difficulty: question.difficulty, options: (question.options || []).map((option) => ({ key: option.key, text: option.text })) })) }); }
export async function deleteTest(request, response) { const deleted = await Test.findByIdAndDelete(request.params.id).lean(); if (!deleted) return response.status(404).json({ message: "Test not found" }); await Submission.deleteMany({ testId: request.params.id }); return response.json({ ok: true, deletedId: deleted._id }); }
