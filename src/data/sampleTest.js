// Provide sample test data used for seeding or local fallback scenarios.

export const sampleTest = {
  title: "GEST Full Mock Test",
  description:
    "A modern demo exam flow for aptitude, reasoning, and English with skip and review support plus solution analytics.",
  durationMinutes: 45,
  totalMarks: 40,
  instructions: [
    "Each question has exactly one correct option.",
    "You can answer, skip, or mark any question for review.",
    "Marked for review questions can be submitted with or without an answer.",
    "After submission, solutions can be filtered by status such as correct, incorrect, skipped, and review."
  ],
  questions: [
    {
      number: 1,
      subject: "Quantitative Aptitude",
      difficulty: "Easy",
      prompt: "If a train covers 180 km in 3 hours, what is its average speed?",
      options: [
        { key: "A", text: "50 km/h" },
        { key: "B", text: "60 km/h" },
        { key: "C", text: "70 km/h" },
        { key: "D", text: "90 km/h" }
      ],
      correctOption: "B",
      explanation: "Average speed equals total distance divided by total time, so 180 / 3 = 60 km/h."
    },
    {
      number: 2,
      subject: "Logical Reasoning",
      difficulty: "Medium",
      prompt: "Find the next term: 2, 6, 12, 20, 30, ?",
      options: [
        { key: "A", text: "36" },
        { key: "B", text: "40" },
        { key: "C", text: "42" },
        { key: "D", text: "48" }
      ],
      correctOption: "C",
      explanation: "The pattern adds consecutive even numbers: +4, +6, +8, +10, so next is +12 giving 42."
    },
    {
      number: 3,
      subject: "English",
      difficulty: "Easy",
      prompt: "Choose the correctly spelled word.",
      options: [
        { key: "A", text: "Accomodation" },
        { key: "B", text: "Acommodation" },
        { key: "C", text: "Accommodation" },
        { key: "D", text: "Accommudation" }
      ],
      correctOption: "C",
      explanation: "Accommodation is the correct spelling with double c and double m."
    },
    {
      number: 4,
      subject: "Quantitative Aptitude",
      difficulty: "Medium",
      prompt: "A shop gives 10% discount on an item priced at 800. What is the selling price?",
      options: [
        { key: "A", text: "720" },
        { key: "B", text: "700" },
        { key: "C", text: "740" },
        { key: "D", text: "760" }
      ],
      correctOption: "A",
      explanation: "10% of 800 is 80, so the discounted selling price is 800 - 80 = 720."
    },
    {
      number: 5,
      subject: "Logical Reasoning",
      difficulty: "Hard",
      prompt: "If all pens are blue and some blue things are books, which conclusion is definitely true?",
      options: [
        { key: "A", text: "All books are pens" },
        { key: "B", text: "Some pens are books" },
        { key: "C", text: "All pens are blue" },
        { key: "D", text: "No blue thing is a book" }
      ],
      correctOption: "C",
      explanation: "The first statement directly establishes that every pen is blue."
    },
    {
      number: 6,
      subject: "English",
      difficulty: "Medium",
      prompt: "Choose the sentence with correct grammar.",
      options: [
        { key: "A", text: "She do not like coffee." },
        { key: "B", text: "She does not likes coffee." },
        { key: "C", text: "She does not like coffee." },
        { key: "D", text: "She not does like coffee." }
      ],
      correctOption: "C",
      explanation: "With 'does not', the main verb stays in base form: like."
    }
  ]
};
