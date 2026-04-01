import "dotenv/config";

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://127.0.0.1:8000";

export async function generateTestFromPrompt(prompt) {
  let response;

  try {
    response = await fetch(`${PYTHON_AI_URL}/generate-test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });
  } catch (error) {
    if (error?.cause?.code === "ECONNREFUSED") {
      throw new Error(`Python AI service is not running at ${PYTHON_AI_URL}. Start it before generating a test.`);
    }

    throw new Error(`Unable to reach Python AI service: ${error.message}`);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "AI service request failed" }));
    throw new Error(error.detail || "AI service request failed");
  }

  return response.json();
}
