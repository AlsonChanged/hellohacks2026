import { z } from "zod";

const envSchema = z
  .object({
    SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

    // Gemini: an AI Studio key takes precedence; otherwise Vertex AI via ADC.
    GEMINI_API_KEY: z.string().min(1).optional(),
    GOOGLE_CLOUD_PROJECT: z.string().min(1).optional(),
    GOOGLE_CLOUD_LOCATION: z.string().min(1).default("us-central1"),
    GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),

    // Apify runs the scrape from its own servers. When unset, the direct web endpoint is used.
    APIFY_TOKEN: z.string().min(1).optional(),
    APIFY_INSTAGRAM_ACTOR: z.string().min(1).default("apify~instagram-profile-scraper"),

    // Only used by the direct web scraper: optional logged-in session cookie.
    INSTAGRAM_SESSION_ID: z.string().min(1).optional(),

    CRON_SECRET: z.string().min(16).optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  })
  .refine((env) => env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL, {
    message: "Set SUPABASE_URL",
  });

export type ServerEnv = {
  supabaseUrl: string;
  serviceRoleKey: string;
  gemini:
    | { mode: "api_key"; apiKey: string; model: string }
    | { mode: "vertex"; project: string; location: string; model: string }
    | null;
  apify: { token: string; actor: string } | null;
  instagramSessionId: string | undefined;
  cronSecret: string | undefined;
  nodeEnv: "development" | "test" | "production";
};

let cached: ServerEnv | undefined;

// Validated lazily rather than at import so `next build` does not need secrets.
export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "env"}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
  }
  const env = parsed.data;
  cached = {
    supabaseUrl: (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL)!,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    gemini: env.GEMINI_API_KEY
      ? { mode: "api_key", apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL }
      : env.GOOGLE_CLOUD_PROJECT
        ? { mode: "vertex", project: env.GOOGLE_CLOUD_PROJECT, location: env.GOOGLE_CLOUD_LOCATION, model: env.GEMINI_MODEL }
        : null,
    apify: env.APIFY_TOKEN ? { token: env.APIFY_TOKEN, actor: env.APIFY_INSTAGRAM_ACTOR } : null,
    instagramSessionId: env.INSTAGRAM_SESSION_ID,
    cronSecret: env.CRON_SECRET,
    nodeEnv: env.NODE_ENV,
  };
  return cached;
}
