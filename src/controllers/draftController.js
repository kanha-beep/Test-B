import { ImportDraft } from "../models/ImportDraft.js";

export async function upsertDraft(request, response) {
  const userId = request.user._id;
  const {
    title = "",
    description = "",
    sourceFileName = "",
    durationMinutes = 30,
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
      questions: draft.questions,
      confirmedIds: draft.confirmedIds,
      warnings: draft.warnings,
      updatedAt: draft.updatedAt
    }
  });
}

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
      questions: draft.questions,
      confirmedIds: draft.confirmedIds,
      warnings: draft.warnings,
      updatedAt: draft.updatedAt
    }
  });
}
