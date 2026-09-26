import type { InstagramAccount, ScrapedPost } from "@/lib/types";
import { normalizeHandle, profileUrlFor } from "./handle";
import { parseFollowerCount } from "./followers";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function edgesOf(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value)) return [];
  const edges = value["edges"];
  if (!Array.isArray(edges)) return [];
  return edges
    .map((e) => (isRecord(e) ? e["node"] : undefined))
    .filter((n): n is Record<string, unknown> => isRecord(n));
}

function isoFromUnixSeconds(seconds: unknown): string | null {
  const n = num(seconds);
  if (n === null) return null;
  const date = new Date(n * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mediaUrlsOf(node: Record<string, unknown>): string[] {
  const children = edgesOf(node["edge_sidecar_to_children"]);
  const urls =
    children.length > 0
      ? children.map((child) => str(child["display_url"])).filter((u): u is string => !!u)
      : [str(node["display_url"])].filter((u): u is string => !!u);
  return Array.from(new Set(urls));
}

function captionOf(node: Record<string, unknown>): string | null {
  const [first] = edgesOf(node["edge_media_to_caption"]);
  return first ? str(first["text"]) : null;
}

function normalizePost(node: Record<string, unknown>): ScrapedPost {
  const shortcode = str(node["shortcode"]) ?? "";
  const pinned = node["pinned_for_users"];
  return {
    instagramPostId: str(node["id"]) ?? shortcode,
    shortcode,
    postUrl: `https://www.instagram.com/p/${shortcode}/`,
    caption: captionOf(node),
    postedAt: isoFromUnixSeconds(node["taken_at_timestamp"]),
    mediaUrls: mediaUrlsOf(node),
    isPinned: Array.isArray(pinned) && pinned.length > 0,
    rawData: node,
  };
}

/** Pure: derives an InstagramAccount from Instagram's web_profile_info response. */
export function normalizeWebProfile(json: unknown, handle: string): InstagramAccount {
  const root = isRecord(json) ? json : {};
  const data = isRecord(root["data"]) ? root["data"] : {};
  const user = isRecord(data["user"]) ? data["user"] : null;

  if (!user) {
    throw new Error("normalizeWebProfile: data.user is missing/null");
  }

  const isPrivate = user["is_private"] === true;

  // Private accounts we can't view have no visible posts regardless of what the payload contains.
  const postNodes = isPrivate ? [] : edgesOf(user["edge_owner_to_timeline_media"]);
  const posts = postNodes.map(normalizePost);

  const mostRecentPostAt = posts.reduce<string | null>((max, post) => {
    if (!post.postedAt) return max;
    if (!max || post.postedAt > max) return post.postedAt;
    return max;
  }, null);

  const fullName = str(user["full_name"]);
  const displayName = fullName?.trim() ? fullName.trim() : null;

  const username = normalizeHandle(str(user["username"]) ?? handle);

  // Keep account rawData small: post edges are large and each post already keeps its own node.
  const rawUser = { ...user };
  delete rawUser["edge_owner_to_timeline_media"];

  return {
    username,
    profileUrl: profileUrlFor(username),
    displayName,
    followerCount: parseFollowerCount(
      isRecord(user["edge_followed_by"]) ? user["edge_followed_by"]["count"] : undefined,
    ),
    mostRecentPostAt,
    isPrivate,
    posts,
    rawData: rawUser,
  };
}
