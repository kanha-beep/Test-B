// Seed the database with starter data for local development or demos.

import mongoose from "mongoose";
import { connectDb } from "./config/db.js";
import { sampleTest } from "./data/sampleTest.js";
import { Submission } from "./models/Submission.js";
import { Test } from "./models/Test.js";

// Handle the seed logic for this module.
async function seed() {
  await connectDb();

  await Submission.deleteMany({});
  // await Test.deleteMany({});
  await Test.create(sampleTest);

  await mongoose.connection.close();
  console.log("Seeded sample GEST test data.");
}

seed().catch(async (error) => {
  console.error("Seed failed:", error);
  await mongoose.connection.close();
  process.exit(1);
});
