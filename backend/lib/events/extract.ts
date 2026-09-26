import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { serverEnv } from "@/lib/env";
import { extractedEventSchema, type ExtractedEvent } from "./schema";

type ExtractionInput = {
  caption: string;
  clubName: string;
  clubHandle: string;
  postUrl: string;
  postedAt?: string;
  mediaUrl?: string;
};

export async function extractEvent(input: ExtractionInput): Promise<ExtractedEvent> {
  const env = serverEnv();
  const client = new OpenAI({ apiKey: env.openAiKey });
  const context = [
    `Club: ${input.clubName} (@${input.clubHandle.replace(/^@/, "")})`,
    `Post URL: ${input.postUrl}`,
    `Post published: ${input.postedAt ?? "unknown"}`,
    `Caption:\n${input.caption}`,
  ].join("\n\n");

  const content: OpenAI.Responses.ResponseInputContent[] = [
    { type: "input_text", text: context },
  ];
  if (input.mediaUrl) content.push({ type: "input_image", image_url: input.mediaUrl, detail: "auto" });

  const response = await client.responses.parse({
    model: env.openAiModel,
    instructions: [
      "Extract one real upcoming event from a university club Instagram post.",
      "Use America/Vancouver when the post gives local times without a timezone.",
      "Never invent missing facts: use null, false, or an empty string/list as appropriate.",
      "price_label preserves the human wording; price_cents is CAD cents for a single numeric price.",
      "Set is_event=false for recaps, general recruitment posts, memes, or unrelated content.",
      "Tags must be short lowercase discovery terms. Description should be concise and factual.",
      "Read useful text from the image when one is supplied.",
    ].join(" "),
    input: [{ role: "user", content }],
    text: { format: zodTextFormat(extractedEventSchema, "club_event") },
  });

  if (!response.output_parsed) throw new Error("The extraction model returned no structured event.");
  return extractedEventSchema.parse(response.output_parsed);
}

