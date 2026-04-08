from typing import Literal
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, Field

# Load environment variables from the local .env file before reading config.
load_dotenv()

# Allow the model name to be configured without changing code.
MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
# Create one reusable OpenAI client for request handling.
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# Define the exact shape of each multiple-choice option returned by the model.
class Option(BaseModel):
    key: Literal["A", "B", "C", "D"]
    text: str


# Define the schema for a single generated question.
class GeneratedQuestion(BaseModel):
    subject: str
    difficulty: Literal["Easy", "Medium", "Hard"]
    prompt: str
    options: list[Option] = Field(min_length=4, max_length=4)
    correctOption: Literal["A", "B", "C", "D"]
    explanation: str


# Define the full generated test schema enforced on model output.
class GeneratedTest(BaseModel):
    title: str
    description: str
    durationMinutes: int = Field(ge=5, le=180)
    instructions: list[str] = Field(default_factory=list)
    questions: list[GeneratedQuestion] = Field(min_length=5, max_length=25)


# Define the request body expected by the generation endpoint.
class GenerateRequest(BaseModel):
    prompt: str


# Create the FastAPI application used by the Node server for AI generation.
app = FastAPI(title="GEST AI Test Generator")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Expose a simple health endpoint for quick backend checks.
@app.get("/health")
def health():
    # Return a small status payload that also confirms the configured model.
    return {"ok": True, "model": MODEL}


# Generate one structured test and validate the model output against the schema.
@app.post("/generate-test", response_model=GeneratedTest)
def generate_test(payload: GenerateRequest):
    # Fail fast when the OpenAI API key is missing from the environment.
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is missing")

    # Trim whitespace so blank prompts are rejected correctly.
    prompt = payload.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    # Ask the model for a fully structured test that matches the Pydantic schema.
    try:
        response = client.responses.parse(
            model=MODEL,
            input=[
                {
                    "role": "system",
                    "content": (
                        "You create high-quality online mock tests. "
                        "Return one clean test with exactly 4 options per question. "
                        "Questions must be unambiguous, exam-ready, and suitable for a timed test UI."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        f"Create a mock test from this request: {prompt}. "
                        "Return 10 questions unless the request explicitly asks for another count. "
                        "Each question must include subject, difficulty, prompt, four options with keys A to D, "
                        "the correct option key, and a short explanation."
                    )
                }
            ],
            text_format=GeneratedTest,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OpenAI generation failed: {exc}") from exc

    # Read the parsed structured object returned by the Responses API.
    parsed = response.output_parsed
    if not parsed:
        raise HTTPException(status_code=500, detail="Model did not return a structured test")

    # Return the validated test object to the caller.
    return parsed

