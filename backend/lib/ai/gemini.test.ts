import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerEnv } from "@/lib/env";

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
  ctor: vi.fn(),
  gemini: null as ServerEnv["gemini"],
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mocks.generateContent };
    constructor(opts: unknown) {
      mocks.ctor(opts);
    }
  },
}));

vi.mock("@/lib/env", () => ({ serverEnv: () => ({ gemini: mocks.gemini }) }));

import { analyzeInstagramPost, EXTRACTION_JSON_SCHEMA } from "./gemini";
import { buildPostContext } from "./prompts";

const fixture = (name: string) => readFileSync(join(__dirname, "__fixtures__", name), "utf8");

const input = {
  caption: "Save the date: Hackathon October 10! Register at bit.ly/ubchacks",
  postedAt: "2026-09-26T03:30:00Z",
  accountHandle: "ubcgamedev",
  accountDisplayName: "UBC Game Dev",
  postUrl: "https://www.instagram.com/p/abc/",
};

beforeEach(() => {
  mocks.generateContent.mockReset();
  mocks.ctor.mockReset();
  mocks.gemini = { mode: "api_key", apiKey: "k", model: "gemini-2.5-flash" };
});

describe("analyzeInstagramPost", () => {
  it("parses a valid event and sends caption-only context and schema", async () => {
    mocks.generateContent.mockResolvedValue({ text: fixture("event.json") });
    const { extraction, model } = await analyzeInstagramPost(input);
    expect(model).toBe("gemini-2.5-flash");
    expect(extraction.is_event).toBe(true);
    expect(extraction.event?.title).toBe("UBC Hackathon 2026");

    const req = mocks.generateContent.mock.calls[0][0];
    expect(req.model).toBe("gemini-2.5-flash");
    expect(req.config.responseMimeType).toBe("application/json");
    expect(req.config.responseJsonSchema).toBe(EXTRACTION_JSON_SCHEMA);
    expect(req.config.temperature).toBeLessThanOrEqual(0.2);
    expect(req.config.systemInstruction).toContain("ONLY the post's caption text");
    const parts = req.contents[0].parts;
    expect(parts[0].text).toContain("Save the date: Hackathon October 10");
    expect(parts[0].text).toContain("Friday, 2026-09-25 20:30");
    expect(parts).toHaveLength(1);
  });

  it("parses a non-event", async () => {
    mocks.generateContent.mockResolvedValue({ text: fixture("not-event.json") });
    const { extraction } = await analyzeInstagramPost(input);
    expect(extraction).toMatchObject({ is_event: false, event: null });
  });

  it("accepts JSON wrapped in a code fence", async () => {
    mocks.generateContent.mockResolvedValue({ text: "```json\n" + fixture("not-event.json") + "\n```" });
    await expect(analyzeInstagramPost(input)).resolves.toBeTruthy();
  });

  it("throws on malformed JSON", async () => {
    mocks.generateContent.mockResolvedValue({ text: '{"is_event": true, "event": {' });
    await expect(analyzeInstagramPost(input)).rejects.toThrow(/invalid JSON/);
  });

  it("throws on empty output", async () => {
    mocks.generateContent.mockResolvedValue({ text: undefined });
    await expect(analyzeInstagramPost(input)).rejects.toThrow(/empty/);
  });

  it("throws when is_event is true but event is null", async () => {
    mocks.generateContent.mockResolvedValue({ text: fixture("event-null-mismatch.json") });
    await expect(analyzeInstagramPost(input)).rejects.toThrow(/schema validation/);
  });

  it("throws when a field violates the schema", async () => {
    const bad = JSON.parse(fixture("event.json"));
    bad.event.start.time = "7pm";
    mocks.generateContent.mockResolvedValue({ text: JSON.stringify(bad) });
    await expect(analyzeInstagramPost(input)).rejects.toThrow(/schema validation/);
  });

  it("propagates API errors", async () => {
    mocks.generateContent.mockRejectedValue(new Error("429 quota"));
    await expect(analyzeInstagramPost(input)).rejects.toThrow("429 quota");
  });

  it("constructs an API-key client", async () => {
    mocks.generateContent.mockResolvedValue({ text: fixture("not-event.json") });
    await analyzeInstagramPost(input);
    expect(mocks.ctor).toHaveBeenCalledWith({ apiKey: "k" });
  });

  it("constructs a Vertex AI client", async () => {
    mocks.gemini = { mode: "vertex", project: "proj", location: "us-central1", model: "gemini-2.5-pro" };
    mocks.generateContent.mockResolvedValue({ text: fixture("not-event.json") });
    const { model } = await analyzeInstagramPost(input);
    expect(mocks.ctor).toHaveBeenCalledWith({ vertexai: true, project: "proj", location: "us-central1" });
    expect(model).toBe("gemini-2.5-pro");
  });

  it("throws a config error when Gemini is not configured", async () => {
    mocks.gemini = null;
    await expect(analyzeInstagramPost(input)).rejects.toThrow(/Gemini is not configured/);
    expect(mocks.generateContent).not.toHaveBeenCalled();
  });
});

describe("EXTRACTION_JSON_SCHEMA", () => {
  it("has no keys Gemini rejects", () => {
    const s = JSON.stringify(EXTRACTION_JSON_SCHEMA);
    expect(s).not.toContain("$schema");
    expect(s).not.toContain("pattern");
    expect(s).toContain("is_event");
  });
});

describe("buildPostContext", () => {
  it("handles missing caption and timestamp", () => {
    const text = buildPostContext({ ...input, caption: null, postedAt: null, accountDisplayName: null });
    expect(text).toContain("Account: @ubcgamedev");
    expect(text).toContain("Posted: unknown");
    expect(text).toContain("(no caption)");
  });
});
