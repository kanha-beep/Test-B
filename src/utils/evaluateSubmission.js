function normalizeOption(option) {
  if (!option) {
    return { key: "", text: "", explanation: "" };
  }
  const plain = typeof option.toObject === "function" ? option.toObject() : option;
  return {
    key: plain.key,
    text: plain.text ?? "",
    explanation: String(plain.explanation ?? "").trim()
  };
}

function deriveStatus(answer, question) {
  const isReview = answer.status === "review" || answer.status === "review_answered";
  const hasAnswer = Boolean(answer.selectedOption);
  const isCorrect = answer.selectedOption === question.correctOption;

  if (!hasAnswer && isReview) {
    return "review";
  }

  if (!hasAnswer) {
    return "skipped";
  }

  if (isReview) {
    return isCorrect ? "review_correct" : "review_incorrect";
  }

  return isCorrect ? "correct" : "incorrect";
}

export function evaluateSubmission(test, answers) {
  const answerMap = new Map(answers.map((answer) => [String(answer.questionId), answer]));
  const positiveMarks = Number(test.positiveMarks ?? 2);
  const negativeMarks = Number(test.negativeMarks ?? -1 / 3);

  const evaluatedAnswers = test.questions.map((question) => {
    const rawAnswer = answerMap.get(String(question._id)) || {
      questionId: question._id,
      selectedOption: null,
      status: "skipped"
    };

    const status = deriveStatus(rawAnswer, question);
    const marksAwarded =
      status === "correct" || status === "review_correct"
        ? positiveMarks
        : status === "incorrect" || status === "review_incorrect"
          ? negativeMarks
          : 0;

    const optionsNormalized = (question.options || []).map((option) => normalizeOption(option));

    return {
      questionId: question._id,
      questionNumber: question.number,
      prompt: question.prompt,
      options: optionsNormalized,
      selectedOption: rawAnswer.selectedOption || null,
      correctOption: question.correctOption,
      explanation: String(question.explanation ?? "").trim(),
      status,
      marksAwarded
    };
  });

  const summary = evaluatedAnswers.reduce(
    (accumulator, answer) => {
      if (answer.status === "correct" || answer.status === "review_correct") {
        accumulator.correct += 1;
      } else if (answer.status === "incorrect" || answer.status === "review_incorrect") {
        accumulator.incorrect += 1;
      } else if (answer.status === "skipped") {
        accumulator.skipped += 1;
      } else {
        accumulator.review += 1;
      }

      return accumulator;
    },
    { correct: 0, incorrect: 0, skipped: 0, review: 0 }
  );

  return {
    score: evaluatedAnswers.reduce((total, answer) => total + answer.marksAwarded, 0),
    summary,
    evaluatedAnswers
  };
}
