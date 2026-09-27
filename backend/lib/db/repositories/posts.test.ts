import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ScrapedPost } from "@/lib/types";

const rpcMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: (...args: unknown[]) => rpcMock(...args) }),
}));

const { computeContentHash, upsertScrapedPosts } = await import("./posts");

function scrapedPost(overrides: Partial<ScrapedPost> = {}): ScrapedPost {
  return {
    instagramPostId: "123",
    shortcode: "abc",
    postUrl: "https://www.instagram.com/p/abc/",
    caption: "Come to our event",
    postedAt: "2026-09-20T00:00:00.000Z",
    mediaUrls: ["https://cdn.example.com/signed-1.jpg"],
    isPinned: false,
    rawData: {},
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("computeContentHash", () => {
  it("is stable for the same caption/postedAt", () => {
    const a = computeContentHash("hello", "2026-09-20T00:00:00.000Z");
    const b = computeContentHash("hello", "2026-09-20T00:00:00.000Z");
    expect(a).toBe(b);
  });

  it("changes when the caption changes", () => {
    const a = computeContentHash("hello", "2026-09-20T00:00:00.000Z");
    const b = computeContentHash("goodbye", "2026-09-20T00:00:00.000Z");
    expect(a).not.toBe(b);
  });

  it("changes when the post time changes (relative dates resolve against it)", () => {
    const a = computeContentHash("hello", "2026-09-20T00:00:00.000Z");
    const b = computeContentHash("hello", "2026-09-21T00:00:00.000Z");
    expect(a).not.toBe(b);
  });
});

describe("upsertScrapedPosts", () => {
  it("refreshes media/raw payload but does not re-queue when only the CDN URL changed", async () => {
    const post = scrapedPost({ mediaUrls: ["https://cdn.example.com/rotated-signed-url.jpg"] });
    rpcMock.mockResolvedValue({ data: [{ found: 1, inserted: 0 }], error: null });

    const result = await upsertScrapedPosts("acct-1", [post]);

    expect(result).toEqual({ found: 1, inserted: 0 });
    expect(rpcMock).toHaveBeenCalledOnce();
    expect(rpcMock.mock.calls[0][0]).toBe("upsert_scraped_posts");
    expect(rpcMock.mock.calls[0][1]).toMatchObject({
      p_source_id: "acct-1",
      p_posts: [
        {
          external_id: "123",
          media_urls: post.mediaUrls,
          processing_status: "pending",
        },
      ],
    });
  });

  it("sends the content fingerprint used by the RPC to detect changed captions", async () => {
    const post = scrapedPost({ caption: "Updated caption!" });
    rpcMock.mockResolvedValue({ data: [{ found: 1, inserted: 0 }], error: null });

    const result = await upsertScrapedPosts("acct-1", [post]);

    expect(result).toEqual({ found: 1, inserted: 0 });
    expect(rpcMock.mock.calls[0][1].p_posts[0]).toMatchObject({
      caption: "Updated caption!",
      content_hash: computeContentHash(post.caption, post.postedAt),
      processing_status: "pending",
    });
  });

  it("inserts new posts as pending, or skipped when there's no caption", async () => {
    const withContent = scrapedPost();
    // Media alone is not enough: extraction is text-only.
    const empty = scrapedPost({ instagramPostId: "999", caption: "   " });
    rpcMock.mockResolvedValue({ data: [{ found: 2, inserted: 2 }], error: null });

    const result = await upsertScrapedPosts("acct-1", [withContent, empty]);

    expect(result).toEqual({ found: 2, inserted: 2 });
    const payload = rpcMock.mock.calls[0][1].p_posts;
    expect(payload[0]).toMatchObject({ processing_status: "pending" });
    expect(payload[1]).toMatchObject({ processing_status: "skipped" });
  });

  it("does not call Supabase for an empty scrape", async () => {
    await expect(upsertScrapedPosts("acct-1", [])).resolves.toEqual({ found: 0, inserted: 0 });
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
