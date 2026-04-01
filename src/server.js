import cors from "cors";
import express from "express";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import testRoutes from "./routes/testRoutes.js";

const app = express();
const allowedOrigin = process.env.FRONT_END_URI.split(",")
console.log("Allowed origins:", allowedOrigin);
app.use(
  cors({
    origin: allowedOrigin
  })
);
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.use("/api/tests", testRoutes);

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ message: "Internal server error" });
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
