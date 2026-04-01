import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    selectedOption: { type: String, default: null },
    status: {
      type: String,
      enum: ["answered", "skipped", "review", "review_answered"],
      required: true
    }
  },
  { _id: false }
);

const evaluatedAnswerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    questionNumber: { type: Number, required: true },
    prompt: { type: String, required: true },
    options: [
      {
        key: String,
        text: String
      }
    ],
    selectedOption: { type: String, default: null },
    correctOption: { type: String, required: true },
    explanation: { type: String, required: true },
    marksAwarded: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["correct", "incorrect", "skipped", "review", "review_correct", "review_incorrect"],
      required: true
    }
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    testId: { type: mongoose.Schema.Types.ObjectId, ref: "Test", required: true },
    candidateName: { type: String, required: true },
    answers: { type: [answerSchema], default: [] },
    score: { type: Number, required: true },
    summary: {
      correct: { type: Number, default: 0 },
      incorrect: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      review: { type: Number, default: 0 }
    },
    evaluatedAnswers: { type: [evaluatedAnswerSchema], default: [] }
  },
  { timestamps: true }
);

export const Submission = mongoose.model("Submission", submissionSchema);
