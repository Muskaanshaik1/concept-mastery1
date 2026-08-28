import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";

function logErrorToFile(context, err, extra) {
  try {
    const entry = {
      time: new Date().toISOString(),
      context,
      error: err && err.stack ? err.stack : String(err),
      extra: extra || null,
    };
    fs.appendFileSync("server_error.log", JSON.stringify(entry) + "\n");
  } catch (e) {
    console.error("Failed to write server_error.log", e);
  }
}

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = "gemini-3.6-flash";

app.get("/", (req, res) => {
  res.json({ message: "ConceptMastery AI server is running!" });
});

function extractTextFromResponse(resp) {
  if (!resp) return "";
  if (typeof resp === "string") return resp;
  if (resp.text && typeof resp.text === "string") return resp.text;

  // genai may return output -> [{ content: [{ text: '...' }] }]
  if (Array.isArray(resp.output)) {
    return resp.output
      .map((o) => {
        if (!o) return "";
        if (typeof o.content === "string") return o.content;
        if (Array.isArray(o.content)) {
          return o.content.map((c) => (c && (c.text || (typeof c === 'string' ? c : ''))) || "").join("");
        }
        return "";
      })
      .join("");
  }

  // older shapes: candidates
  if (Array.isArray(resp.candidates)) {
    return resp.candidates.map((c) => c.text || "").join("\n");
  }

  try {
    return JSON.stringify(resp);
  } catch (e) {
    return String(resp);
  }
}

function parseAIJson(text) {
  if (!text) throw new Error("Empty AI response text");

  // Strip common markdown fences
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();

  // Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // continue to heuristics
  }

  // Try to extract a top-level JSON object by finding the first '{' and last '}'
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    const candidate = cleaned.substring(first, last + 1);
    try {
      return JSON.parse(candidate);
    } catch (e) {
      // fall through
    }
  }

  // As a final attempt, match a JSON object/array with a regex
  const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      // fall through
    }
  }

  throw new Error("Unable to parse JSON from AI response. Excerpt: " + cleaned.slice(0, 1000));
}

app.post("/api/learn", async (req, res) => {
  try {
    const { topic, level } = req.body;
    if (!topic) return res.status(400).json({ error: "Topic is required" });

    const prompt = `
You are an expert AI learning tutor.

Topic: ${topic}
Level: ${level || "Beginner"}

Teach this concept clearly and simply for this level.

Return ONLY valid JSON in exactly this structure:

{
  "title": "short title",
  "explanation": "clear explanation of the concept",
  "example": "simple practical example",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "questions": [
    {
      "question": "question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correctAnswer": "the correct option text",
      "reason": "why this is correct"
    }
  ]
}

Generate exactly 5 questions testing real understanding of "${topic}", not trivia.
Do not use markdown code fences. Return only JSON.
`;

const generated = await ai.models.generateContent({ model: MODEL, contents: prompt });
const text = extractTextFromResponse(generated);
try {
  const result = parseAIJson(text);
  res.json(result);
} catch (err) {
  console.error("AI Parse Error (/api/learn):", err, "full response:", JSON.stringify(generated, null, 2));
  logErrorToFile("/api/learn - parse", err, { generated });
  res.status(502).json({ error: "Failed to parse AI response", details: err.message });
}
  } catch (error) {
    console.error("AI Error (/api/learn):", error);
  logErrorToFile("/api/learn - error", error, { body: req.body });
  res.status(500).json({ error: "Something went wrong while generating the learning content." });
  }
});

app.post("/api/diagnose", async (req, res) => {
  try {
    const { topic, level, results } = req.body;
    if (!topic || !results) {
      return res.status(400).json({ error: "topic and results are required" });
    }

    const prompt = `
You are an AI tutor analyzing a student's quiz performance on "${topic}" (level: ${level || "Beginner"}).

Their answers:
${JSON.stringify(results, null, 2)}

For each WRONG answer, identify the likely underlying misconception (WHY they likely chose that option, not just that it's wrong).

Return ONLY valid JSON in exactly this structure:

{
  "overallMastery": "1-2 sentence summary of their understanding",
  "masteryLevel": "Weak" | "Developing" | "Strong",
  "misconceptions": [
    {
      "question": "the question text",
      "likelyMisconception": "what they probably misunderstood",
      "correction": "a short, clear correction"
    }
  ],
  "recommendedNextStep": "what to review or practice next"
}

Only include entries in "misconceptions" for wrong answers. Do not use markdown code fences. Return only JSON.
`;

const generated = await ai.models.generateContent({ model: MODEL, contents: prompt });
const text = extractTextFromResponse(generated);
try {
  const result = parseAIJson(text);
  res.json(result);
} catch (err) {
  console.error("AI Parse Error (/api/diagnose):", err, "full response:", JSON.stringify(generated, null, 2));
  logErrorToFile("/api/diagnose - parse", err, { generated });
  res.status(502).json({ error: "Failed to parse AI response", details: err.message });
}
  } catch (error) {
    console.error("AI Error (/api/diagnose):", error);
    logErrorToFile("/api/diagnose - error", error, { body: req.body });
    res.status(500).json({ error: "Something went wrong while diagnosing the results." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`ConceptMastery AI server running on port ${PORT}`);
});