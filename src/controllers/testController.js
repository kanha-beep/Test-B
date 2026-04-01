import { Test } from "../models/Test.js";
import { generateTestFromPrompt } from "../services/aiService.js";
import { parsePdfFile } from "../services/pdfParserService.js";
import { readdir } from "fs/promises";
import { resolve, join } from "path";

const PDF_FOLDER = resolve("pdf");

function defaultInstructions(positiveMarks = 2, negativeMarks = -1 / 3) {
  return [
    "Each question has one correct answer.",
    `Scoring: +${positiveMarks} for correct answers and ${negativeMarks} for incorrect answers.`,
    "You can skip questions or mark them for review before submitting."
  ];
}

function sanitizeImportedQuestion(question, index) {
  console.log("1. Sanitizing question: ", question);
  const optionKeys = ["A", "B", "C", "D"];
  const optionMap = new Map((question.options || []).map((option) => [String(option.key || "").toUpperCase(), String(option.text || "").trim()]));
  const options = optionKeys.map((key) => ({ key, text: optionMap.get(key) || "" }));

  return {
    number: index + 1,
    prompt: String(question.prompt || "").trim(),
    subject: String(question.subject || "PDF Import").trim() || "PDF Import",
    difficulty: String(question.difficulty || "Mixed").trim() || "Mixed",
    options,
    correctOption: String(question.correctOption || "").toUpperCase(),
    explanation: String(question.explanation || "Imported from PDF.").trim() || "Imported from PDF."
  };
}

export async function listPdfFiles(_request, response) {
  try {
    console.log("1. Listing all PDF files in folder: ", PDF_FOLDER);
    const files = await readdir(PDF_FOLDER);
    console.log("listed all pdf: ", files);
    response.json(files.filter((f) => f.toLowerCase().endsWith(".pdf")));
  } catch {
    response.json([]);
  }
}

export async function parsePdfFromFolder(request, response) {
  console.log("1. Received request to parse PDF with query: ", request.query);
  const filename = request.query.filename?.trim();
  console.log("2. Extracted filename from query: ", filename);
  if (!filename || filename.includes("..")) {
    return response.status(400).json({ message: "Invalid filename" });
  }
  try {
    console.log("3. Starting PDF parsing for file: ", filename);
    const result = await parsePdfFile(join(PDF_FOLDER, filename));
    console.log("4. PDF parsing completed for file: ", filename);
    console.log("parsed pdf result: ", result);
    return response.json({ title: filename.replace(/\.pdf$/i, ""), ...result });
  } catch (error) {
    return response.status(500).json({ message: error.message || "Failed to parse PDF" });
  }
}

export async function listTests(_request, response) {
  console.log("1. Fetching list of all tests");
  const tests = await Test.find()
    .sort({ createdAt: -1 })
    .select("title description sourceType durationMinutes positiveMarks negativeMarks totalMarks questions instructions createdAt")
    .lean();

  response.json(
    tests.map((test) => ({
      _id: test._id,
      title: test.title,
      description: test.description,
      sourceType: test.sourceType,
      durationMinutes: test.durationMinutes,
      positiveMarks: test.positiveMarks,
      negativeMarks: test.negativeMarks,
      totalMarks: test.totalMarks,
      totalQuestions: test.questions.length,
      instructions: test.instructions,
      createdAt: test.createdAt
    }))
  );
}

export async function createGeneratedTest(request, response) {
  console.log("1. Received request to create generated test with body: ", request.body);
  const prompt = request.body?.prompt?.trim();

  if (!prompt) {
    return response.status(400).json({ message: "Prompt is required" });
  }

  try {
    const generated = await generateTestFromPrompt(prompt);
    const positiveMarks = 2;
    const negativeMarks = -1 / 3;

    const test = await Test.create({
      title: generated.title,
      description: generated.description,
      sourceType: "prompt",
      durationMinutes: generated.durationMinutes,
      positiveMarks,
      negativeMarks,
      totalMarks: generated.questions.length * positiveMarks,
      instructions:
        generated.instructions && generated.instructions.length
          ? generated.instructions
          : defaultInstructions(positiveMarks, negativeMarks),
      questions: generated.questions.map((question, index) => ({
        number: index + 1,
        prompt: question.prompt,
        subject: question.subject || "General",
        difficulty: question.difficulty || "Mixed",
        options: question.options,
        correctOption: question.correctOption,
        explanation: question.explanation || "Generated from prompt."
      }))
    });

    return response.status(201).json({
      _id: test._id,
      title: test.title,
      description: test.description,
      sourceType: test.sourceType,
      durationMinutes: test.durationMinutes,
      positiveMarks: test.positiveMarks,
      negativeMarks: test.negativeMarks,
      totalMarks: test.totalMarks,
      totalQuestions: test.questions.length,
      instructions: test.instructions,
      createdAt: test.createdAt
    });
  } catch (error) {
    return response.status(502).json({
      message: error.message || "Failed to generate test"
    });
  }
}

export async function createImportedTest(request, response) {
  console.log("1. Create Imported Test - Received request with body: ", request.body);
  const title = request.body?.title?.trim();
  const description = request.body?.description?.trim() || "Imported from uploaded PDF.";
  const durationMinutes = Number(request.body?.durationMinutes || 30);
  const incomingQuestions = Array.isArray(request.body?.questions) ? request.body.questions : [];

  if (!title) {
    return response.status(400).json({ message: "Title is required" });
  }

  if (incomingQuestions.length === 0) {
    return response.status(400).json({ message: "At least one question is required" });
  }

  const questions = incomingQuestions.map(sanitizeImportedQuestion);
  const invalidQuestion = questions.find(
    (question) => !question.prompt || !question.correctOption || question.options.some((option) => !option.text)
  );

  if (invalidQuestion) {
    return response.status(400).json({ message: "Each question must have text, four options, and a correct option" });
  }

  const positiveMarks = 2;
  const negativeMarks = -1 / 3;

  const test = await Test.create({
    title,
    description,
    sourceType: "pdf",
    durationMinutes,
    positiveMarks,
    negativeMarks,
    totalMarks: questions.length * positiveMarks,
    instructions: defaultInstructions(positiveMarks, negativeMarks),
    questions
  });

  return response.status(201).json({
    _id: test._id,
    title: test.title,
    description: test.description,
    sourceType: test.sourceType,
    durationMinutes: test.durationMinutes,
    positiveMarks: test.positiveMarks,
    negativeMarks: test.negativeMarks,
    totalMarks: test.totalMarks,
    totalQuestions: test.questions.length,
    instructions: test.instructions,
    createdAt: test.createdAt
  });
}

export async function getTestById(request, response) {
  console.log("1. Get Test By ID - Received request with params: ", request.params);
  const test = await Test.findById(request.params.id).lean();

  if (!test) {
    return response.status(404).json({ message: "Test not found" });
  }

  return response.json({
    _id: test._id,
    title: test.title,
    description: test.description,
    sourceType: test.sourceType,
    durationMinutes: test.durationMinutes,
    positiveMarks: test.positiveMarks,
    negativeMarks: test.negativeMarks,
    totalMarks: test.totalMarks,
    totalQuestions: test.questions.length,
    instructions: test.instructions,
    questions: test.questions.map((question) => ({
      _id: question._id,
      number: question.number,
      prompt: question.prompt,
      subject: question.subject,
      difficulty: question.difficulty,
      options: question.options
    }))
  });
}
