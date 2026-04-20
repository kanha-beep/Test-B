// Define the test model schema stored in MongoDB.

import mongoose from "mongoose";

const optionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    text: { type: String, required: true },
    explanation: { type: String, default: "" }
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true },
    prompt: { type: String, required: true },
    subject: { type: String, default: "General" },
    difficulty: { type: String, default: "Mixed" },
    options: { type: [optionSchema], validate: [(value) => value.length === 4, "Exactly four options are required"] },
    correctOption: { type: String, required: true },
    explanation: { type: String, default: "" }
  },
  { _id: true }
);

const testSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    sourceType: { type: String, enum: ["prompt", "pdf"], default: "prompt" },
    examType: { type: String, default: "General" },
    pageType: { type: String, enum: ["full-test", "sectional", "pyq", "custom"], default: "full-test" },
    explanationMode: { type: String, enum: ["with-solution", "without-explanation"], default: "with-solution" },
    sectionName: { type: String, default: "" },
    syllabusTags: { type: [String], default: [] },
    createdByName: { type: String, default: "System" },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    durationMinutes: { type: Number, required: true },
    positiveMarks: { type: Number, default: 2 },
    negativeMarks: { type: Number, default: -1 / 3 },
    totalMarks: { type: Number, required: true },
    instructions: { type: [String], default: [] },
    questions: { type: [questionSchema], default: [] }
  },
  { timestamps: true }
);

export const Test = mongoose.model("Test", testSchema);
