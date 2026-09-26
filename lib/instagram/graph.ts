import { serverEnv } from "@/lib/env";

export type InstagramMedia = {
  id: string;
  caption?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
};

type Page = { data: InstagramMedia[]; paging?: { cursors?: { after?: string }; next?: string } };

export async function getInstagramAccount(accountId: string) {
  const token = serverEnv().instagramAccessToken;
  if (!token) throw new Error("INSTAGRAM_ACCESS_TOKEN is required for account sync.");
  const url = new URL(`https://graph.facebook.com/v24.0/${accountId}`);
  url.searchParams.set("fields", "username,followers_count");
  url.searchParams.set("access_token", token);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Instagram account request failed (${response.status}): ${await response.text()}`);
  return response.json() as Promise<{ username: string; followers_count?: number }>;
}

export async function listInstagramMedia(accountId: string, after?: string): Promise<Page> {
  const token = serverEnv().instagramAccessToken;
  if (!token) throw new Error("INSTAGRAM_ACCESS_TOKEN is required for account sync.");
  const url = new URL(`https://graph.facebook.com/v24.0/${accountId}/media`);
  url.searchParams.set("fields", "id,caption,media_url,thumbnail_url,permalink,timestamp");
  url.searchParams.set("limit", "25");
  if (after) url.searchParams.set("after", after);
  url.searchParams.set("access_token", token);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Instagram media request failed (${response.status}): ${await response.text()}`);
  return response.json() as Promise<Page>;
}

