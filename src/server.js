// Start the Express server, attach middleware, and register API routes.

import dotenv from "dotenv";

dotenv.config();
import cors from "cors";
import express from "express";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import draftRoutes from "./routes/draftRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import {
  createApiSlowDown,
  createAuthLimiter,
  createAuthSlowDown,
  createGlobalLimiter,
  createHelmet,
  createHpp
} from "./middleware/securityMiddleware.js";

const app = express();

// Express should trust proxy headers in production-style deployments.
if (env.trustProxy) {
  app.set("trust proxy", 1);
}

// Remove framework fingerprinting headers.
app.disable("x-powered-by");

// Apply secure HTTP headers early.
app.use(createHelmet());

// Restrict cross-origin requests to the configured frontend origins.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.allowedOrigin.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS origin not allowed"));
    },
    credentials: false,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// Global request protections.
app.use(createGlobalLimiter());
app.use(createApiSlowDown());
app.use(createHpp());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb", parameterLimit: 50 }));

// Lightweight health check stays available for monitoring.
app.get("/api/health", (_request, response) => {
  response.json({ ok: true, env: env.nodeEnv });
});

// Apply stricter limits only to authentication routes.
app.use("/api/auth", createAuthSlowDown(), createAuthLimiter(), authRoutes);
app.use("/api/drafts", draftRoutes);
app.use("/api/tests", testRoutes);
app.use((_request, response) => {
  response.status(404).json({ message: "Route not found" });
});

// CORS and app errors return safe JSON.
app.use((error, _request, response, _next) => {
  console.error(error);

  if (error.message === "CORS origin not allowed") {
    return response.status(403).json({ message: error.message });
  }

  if (error.name === "ValidationError") {
    return response.status(400).json({ message: error.message || "Validation failed" });
  }

  if (error.name === "CastError") {
    return response.status(400).json({ message: "Invalid resource id" });
  }

  return response.status(error.statusCode || 500).json({ message: error.message || "Internal server error" });
});

connectDb()
  .then(() => {
    app.listen(env.port, () => {
      console.log(`Server running on http://localhost:${env.port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  });
