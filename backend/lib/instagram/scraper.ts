import { serverEnv } from "@/lib/env";
import type { InstagramAccountScraper } from "@/lib/types";
import { ApifyProfileScraper } from "./apifyScraper";
import { WebProfileScraper } from "./webScraper";

/** Apify when APIFY_TOKEN is set; otherwise Instagram's web endpoint directly from this server. */
export function createScraper(): InstagramAccountScraper {
  const env = serverEnv();
  if (env.apify) return new ApifyProfileScraper({ token: env.apify.token, actor: env.apify.actor });
  return new WebProfileScraper({ sessionId: env.instagramSessionId });
}
