// Handle submission creation, grading retrieval, and ranking refresh logic.

import { Submission } from "../models/Submission.js";
import { Test } from "../models/Test.js";
import { User } from "../models/User.js";
import { evaluateSubmission } from "../utils/evaluateSubmission.js";

// Handle the mapSubmissionCard logic for this module.
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

// Handle the listSubmissions logic for this module.
export async function listSubmissions(request, response) {
  const candidateName = request.query.candidateName?.trim();
  let filter = {};

  if (request.user) {
    filter = { userId: request.user._id };
  } else if (candidateName) {
    filter = { candidateName };
  } else {
    return response.status(400).json({ message: "Candidate name is required for guest submissions" });
  }

  const submissions = await Submission.find(filter)
    .sort({ createdAt: -1 })
    .populate("testId", "title totalMarks durationMinutes positiveMarks negativeMarks sourceType examType pageType sectionName")
    .lean();

  return response.json(submissions.map(mapSubmissionCard));
}

// Handle the refreshRankings logic for this module.
async function refreshRankings(testId) {
  const rankedSubmissions = await Submission.find({ testId }).sort({ score: -1, createdAt: 1 }).lean();
  let previousScore = null;
  let currentRank = 0;
  const operations = [];

  for (let index = 0; index < rankedSubmissions.length; index += 1) {
    const submission = rankedSubmissions[index];
    if (submission.score !== previousScore) {
      currentRank = index + 1;
      previousScore = submission.score;
    }

    operations.push({
      updateOne: {
        filter: { _id: submission._id },
        update: {
          $set: {
            rankingSnapshot: { rank: currentRank, totalParticipants: rankedSubmissions.length }
          }
        }
      }
    });
  }

  if (operations.length > 0) {
    await Submission.bulkWrite(operations);
  }
}

// Save a completed submission, score it, and refresh rankings.
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

// Handle the getSubmissionById logic for this module.
export async function getSubmissionById(request, response) {
  const candidateName = request.query.candidateName?.trim();
  const submission = await Submission.findById(request.params.id)
    .populate("testId", "title totalMarks durationMinutes positiveMarks negativeMarks sourceType examType pageType sectionName")
    .lean();

  if (!submission) {
    return response.status(404).json({ message: "Submission not found" });
  }

  if (request.user && submission.userId && String(submission.userId) !== String(request.user._id) && request.user.role !== "admin") {
    return response.status(403).json({ message: "Access denied" });
  }

  if (!request.user && candidateName !== submission.candidateName) {
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

// Return leaderboard rows for a specific test.
export async function getTestRankings(request, response) {
  const test = await Test.findById(request.params.id).select("title examType pageType sectionName totalMarks").lean();
  if (!test) {
    return response.status(404).json({ message: "Test not found" });
  }

  const rankings = await Submission.find({ testId: request.params.id })
    .sort({ score: -1, createdAt: 1 })
    .select("candidateName score summary rankingSnapshot createdAt userId")
    .lean();

  const topRankUserIds = [...new Set(rankings.filter((item) => item.rankingSnapshot?.rank === 1 && item.userId).map((item) => String(item.userId)))];
  const topRankUsers = topRankUserIds.length
    ? await User.find({ _id: { $in: topRankUserIds } }).select("email").lean()
    : [];
  const topRankEmailMap = new Map(topRankUsers.map((user) => [String(user._id), user.email]));

  return response.json({
    test,
    rankings: rankings.map((item) => ({
      submissionId: item._id,
      candidateName: item.candidateName,
      score: item.score,
      summary: item.summary,
      rank: item.rankingSnapshot?.rank || null,
      submittedAt: item.createdAt,
      contactEmail:
        request.user &&
        item.rankingSnapshot?.rank === 1 &&
        item.userId &&
        String(item.userId) !== String(request.user._id)
          ? topRankEmailMap.get(String(item.userId)) || ""
          : ""
    }))
  });
}
