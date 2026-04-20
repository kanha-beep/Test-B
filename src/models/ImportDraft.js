// Define the import-draft model schema stored in MongoDB.

import mongoose from "mongoose";

const importDraftSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    sourceFileName: { type: String, default: "" },
    durationMinutes: { type: Number, default: 30 },
    examType: { type: String, default: "" },
    pageType: { type: String, default: "full-test" },
    explanationMode: { type: String, enum: ["with-solution", "without-explanation"], default: "with-solution" },
    sectionName: { type: String, default: "" },
    syllabusTags: { type: [String], default: [] },
    questions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    confirmedIds: { type: [String], default: [] },
    warnings: { type: [String], default: [] }
  },
  { timestamps: true }
);

export const ImportDraft = mongoose.model("ImportDraft", importDraftSchema);
