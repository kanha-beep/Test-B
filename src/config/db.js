// Connect the server to MongoDB using the configured environment values.

import mongoose from "mongoose";
import { env } from "./env.js";

// Handle the connectDb logic for this module.
export async function connectDb() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri);
  return mongoose.connection;
}
