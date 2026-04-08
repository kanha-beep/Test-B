// Handle saving and retrieving imported-test drafts for users.

import { ImportDraft } from "../models/ImportDraft.js";

// Handle the upsertDraft logic for this module.
export async function upsertDraft(request, response) {
  const userId = request.user._id;
  const {
    title = "",
    description = "",
    sourceFileName = "",
    durationMinutes = 30,
    examType = "",
    pageType = "full-test",
    sectionName = "",
    syllabusTags = [],
    questions = [],
    confirmedIds = [],
    warnings = []
  } = request.body || {};

  const draft = await ImportDraft.findOneAndUpdate(
    { userId },
    {
      userId,
      title,
      description,
      sourceFileName,
      durationMinutes: Number(durationMinutes) || 30,
      examType,
      pageType,
      sectionName,
      syllabusTags: Array.isArray(syllabusTags) ? syllabusTags : [],
      questions: Array.isArray(questions) ? questions : [],
      confirmedIds: Array.isArray(confirmedIds) ? confirmedIds : [],
      warnings: Array.isArray(warnings) ? warnings : []
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return response.json({
    ok: true,
    draft: {
      title: draft.title,
      description: draft.description,
      sourceFileName: draft.sourceFileName,
      durationMinutes: draft.durationMinutes,
      examType: draft.examType,
      pageType: draft.pageType,
      sectionName: draft.sectionName,
      syllabusTags: draft.syllabusTags,
      questions: draft.questions,
      confirmedIds: draft.confirmedIds,
      warnings: draft.warnings,
      updatedAt: draft.updatedAt
    }
  });
}

// Return the newest saved import draft for the current user.
export async function getLatestDraft(request, response) {
  const draft = await ImportDraft.findOne({ userId: request.user._id }).lean();

  if (!draft) {
    return response.json({ draft: null });
  }

  return response.json({
    draft: {
      title: draft.title,
      description: draft.description,
      sourceFileName: draft.sourceFileName,
      durationMinutes: draft.durationMinutes,
      examType: draft.examType,
      pageType: draft.pageType,
      sectionName: draft.sectionName,
      syllabusTags: draft.syllabusTags,
      questions: draft.questions,
      confirmedIds: draft.confirmedIds,
      warnings: draft.warnings,
      updatedAt: draft.updatedAt
    }
  });
}
