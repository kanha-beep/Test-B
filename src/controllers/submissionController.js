import { Submission } from "../models/Submission.js";
import { Test } from "../models/Test.js";
import { evaluateSubmission } from "../utils/evaluateSubmission.js";

function mapSubmissionCard(submission) {
  return {
    _id: submission._id,
    candidateName: submission.candidateName,
    score: submission.score,
    summary: submission.summary,
    submittedAt: submission.createdAt,
    rankingSnapshot: submission.rankingSnapshot || { rank: null, totalParticipants: 0 },
    test: submission.testId
  };
}

export async function listSubmissions(request, response) {
  const candidateName = request.query.candidateName?.trim();
  let filter = {};

  if (request.user) {
    filter = { userId: request.user._id };
  } else if (candidateName) {
    filter = { candidateName };
  }

  const submissions = await Submission.find(filter)
    .sort({ createdAt: -1 })
    .populate("testId", "title totalMarks durationMinutes positiveMarks negativeMarks sourceType examType pageType sectionName")
    .lean();

  return response.json(submissions.map(mapSubmissionCard));
}

async function refreshRankings(testId) {
  const rankedSubmissions = await Submission.find({ testId }).sort({ score: -1, createdAt: 1 }).lean();
  let previousScore = null;
  let currentRank = 0;

  for (let index = 0; index < rankedSubmissions.length; index += 1) {
    const submission = rankedSubmissions[index];
    if (submission.score !== previousScore) {
      currentRank = index + 1;
      previousScore = submission.score;
    }

    await Submission.updateOne(
      { _id: submission._id },
      { $set: { rankingSnapshot: { rank: currentRank, totalParticipants: rankedSubmissions.length } } }
    );
  }
}

export async function submitTest(request, response) {
  const { candidateName, answers } = request.body;
  const test = await Test.findById(request.params.id).lean();

  if (!test) {
    return response.status(404).json({ message: "Test not found" });
  }

  const payloadAnswers = Array.isArray(answers) ? answers : [];
  const evaluation = evaluateSubmission(test, payloadAnswers);
  const resolvedName = request.user?.displayName?.trim() || candidateName?.trim() || "Guest Candidate";

  const submission = await Submission.create({
    testId: test._id,
    userId: request.user?._id || null,
    candidateName: resolvedName,
    answers: payloadAnswers,
    score: evaluation.score,
    summary: evaluation.summary,
    rankingSnapshot: { rank: null, totalParticipants: 0 },
    evaluatedAnswers: evaluation.evaluatedAnswers
  });

  await refreshRankings(test._id);
  const fresh = await Submission.findById(submission._id).lean();

  return response.status(201).json({
    submissionId: fresh._id,
    testId: test._id,
    candidateName: fresh.candidateName,
    score: fresh.score,
    summary: fresh.summary,
    rankingSnapshot: fresh.rankingSnapshot,
    submittedAt: fresh.createdAt
  });
}

export async function getSubmissionById(request, response) {
  const submission = await Submission.findById(request.params.id)
    .populate("testId", "title totalMarks durationMinutes positiveMarks negativeMarks sourceType examType pageType sectionName")
    .lean();

  if (!submission) {
    return response.status(404).json({ message: "Submission not found" });
  }

  if (request.user && submission.userId && String(submission.userId) !== String(request.user._id) && request.user.role !== "admin") {
    return response.status(403).json({ message: "Access denied" });
  }

  return response.json({
    _id: submission._id,
    candidateName: submission.candidateName,
    score: submission.score,
    summary: submission.summary,
    rankingSnapshot: submission.rankingSnapshot || { rank: null, totalParticipants: 0 },
    submittedAt: submission.createdAt,
    test: submission.testId,
    evaluatedAnswers: submission.evaluatedAnswers
  });
}

export async function getTestRankings(request, response) {
  const test = await Test.findById(request.params.id).select("title examType pageType sectionName totalMarks").lean();
  if (!test) {
    return response.status(404).json({ message: "Test not found" });
  }

  const rankings = await Submission.find({ testId: request.params.id })
    .sort({ score: -1, createdAt: 1 })
    .select("candidateName score summary rankingSnapshot createdAt")
    .lean();

  return response.json({
    test,
    rankings: rankings.map((item) => ({
      submissionId: item._id,
      candidateName: item.candidateName,
      score: item.score,
      summary: item.summary,
      rank: item.rankingSnapshot?.rank || null,
      submittedAt: item.createdAt
    }))
  });
}
