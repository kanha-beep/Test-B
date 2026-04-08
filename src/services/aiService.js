// Call the Python AI service to generate structured tests from prompts.

import axios from "axios";
import "dotenv/config";

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://127.0.0.1:8000";

// Ask the Python AI service to generate a new mock test from a prompt.
export async function generateTestFromPrompt(prompt) {
  try {
    const response = await axios.post(
      `${PYTHON_AI_URL}/generate-test`,
      { prompt },
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    return response.data;
  } catch (error) {
    if (error?.code === "ECONNREFUSED" || error?.cause?.code === "ECONNREFUSED") {
      throw new Error(`Python AI service is not running at ${PYTHON_AI_URL}. Start it before generating a test.`);
    }

    const message = error?.response?.data?.detail || error?.message || "AI service request failed";
    throw new Error(error?.response ? message : `Unable to reach Python AI service: ${message}`);
  }
}
