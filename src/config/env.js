import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

export const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/gest-app",
  allowedOrigin: (process.env.FRONT_END_URI || process.env.FRONT_END_URL || "http://localhost:5173").split(",")
};