import { Submission } from "../models/Submission.js";
import { Test } from "../models/Test.js";
import { evaluateSubmission } from "../utils/evaluateSubmission.js";

export async function listSubmissions(request, response) {
  const candidateName = request.query.candidateName?.trim();
  const filter = candidateName ? { candidateName } : {};

  const submissions = await Submission.find(filter)
    .sort({ createdAt: -1 })
    .populate("testId", "title totalMarks durationMinutes positiveMarks negativeMarks sourceType")
    .lean();

  return response.json(
    submissions.map((submission) => ({
      _id: submission._id,
      candidateName: submission.candidateName,
      score: submission.score,
      summary: submission.summary,
      submittedAt: submission.createdAt,
      test: submission.testId
    }))
  );
}

export async function submitTest(request, response) {
  const { candidateName, answers } = request.body;
  const test = await Test.findById(request.params.id);

  if (!test) {
    return response.status(404).json({ message: "Test not found" });
  }

  const payloadAnswers = Array.isArray(answers) ? answers : [];
  const evaluation = evaluateSubmission(test, payloadAnswers);

  const submission = await Submission.create({
    testId: test._id,
    candidateName: candidateName?.trim() || "Guest Candidate",
    answers: payloadAnswers,
    score: evaluation.score,
    summary: evaluation.summary,
    evaluatedAnswers: evaluation.evaluatedAnswers
  });

  return response.status(201).json({
    submissionId: submission._id,
    testId: test._id,
    candidateName: submission.candidateName,
    score: submission.score,
    summary: submission.summary,
    submittedAt: submission.createdAt
  });
}

export async function getSubmissionById(request, response) {
  const submission = await Submission.findById(request.params.id)
    .populate("testId", "title totalMarks durationMinutes positiveMarks negativeMarks sourceType")
    .lean();

  if (!submission) {
    return response.status(404).json({ message: "Submission not found" });
  }

  return response.json({
    _id: submission._id,
    candidateName: submission.candidateName,
    score: submission.score,
    summary: submission.summary,
    submittedAt: submission.createdAt,
    test: submission.testId,
    evaluatedAnswers: submission.evaluatedAnswers
  });
}
