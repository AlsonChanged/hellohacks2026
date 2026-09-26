import { GoogleGenAI, type Part } from "@google/genai";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { aiEventExtractionSchema, type AIEventExtraction } from "./schemas";
import { buildPostContext, EVENT_EXTRACTION_SYSTEM_PROMPT } from "./prompts";

export type AnalyzePostInput = {
  caption: string;
  postedAt: string | null;
  accountHandle: string;
  accountDisplayName: string | null;
  postUrl: string;
};

// Gemini's responseJsonSchema supports a subset of JSON Schema; `$schema` and
// `pattern` are not in it. Zod still enforces the pattern after parsing.
function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupported);
  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node)
        .filter(([k]) => k !== "$schema" && k !== "pattern")
        .map(([k, v]) => [k, stripUnsupported(v)]),
    );
  }
  return node;
}

export const EXTRACTION_JSON_SCHEMA = stripUnsupported(z.toJSONSchema(aiEventExtractionSchema, { target: "draft-7" }));

export function createGeminiClient(): { client: GoogleGenAI; model: string } {
  const cfg = serverEnv().gemini;
  if (!cfg) {
    throw new Error("Gemini is not configured: set GEMINI_API_KEY, or GOOGLE_CLOUD_PROJECT (+ GOOGLE_CLOUD_LOCATION) for Vertex AI");
  }
  const client =
    cfg.mode === "api_key"
      ? new GoogleGenAI({ apiKey: cfg.apiKey })
      : new GoogleGenAI({ vertexai: true, project: cfg.project, location: cfg.location });
  return { client, model: cfg.model };
}

/** Parses raw model text into a validated extraction; throws on anything malformed. */
export function parseExtraction(text: string | undefined): AIEventExtraction {
  if (!text?.trim()) throw new Error("Gemini returned an empty response");
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    throw new Error("Gemini returned invalid JSON");
  }
  const parsed = aiEventExtractionSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join("; ");
    throw new Error(`Gemini output failed schema validation: ${issues}`);
  }
  return parsed.data;
}

export async function analyzeInstagramPost(
  input: AnalyzePostInput,
): Promise<{ extraction: AIEventExtraction; model: string }> {
  const { client, model } = createGeminiClient();
  const parts: Part[] = [
    {
      text: buildPostContext({
        caption: input.caption,
        postedAt: input.postedAt,
        accountHandle: input.accountHandle,
        accountDisplayName: input.accountDisplayName,
        postUrl: input.postUrl,
      }),
    },
  ];
  const response = await client.models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: EVENT_EXTRACTION_SYSTEM_PROMPT,
      temperature: 0.1,
      responseMimeType: "application/json",
      responseJsonSchema: EXTRACTION_JSON_SCHEMA,
    },
  });
  return { extraction: parseExtraction(response.text), model };
}
