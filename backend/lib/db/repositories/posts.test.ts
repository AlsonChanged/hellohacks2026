import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ScrapedPost } from "@/lib/types";

const fromMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (...args: unknown[]) => fromMock(...args) }),
}));

// Minimal thenable query-builder stub: every chain method is a spy returning `obj`
// itself, so tests can both keep chaining and inspect what was passed to e.g. update().
function chain(result: { data?: unknown; error?: unknown }) {
  const obj: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "insert", "update"]) {
    obj[method] = vi.fn(() => obj);
  }
  (obj as { then: unknown }).then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return obj as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<unknown>;
}

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
    const stableHash = computeContentHash(post.caption, post.postedAt);
    const selectChain = chain({ data: [{ id: "row-1", external_id: "123", content_hash: stableHash }], error: null });
    const updateChain = chain({ error: null });
    fromMock.mockReturnValueOnce(selectChain).mockReturnValueOnce(updateChain);

    const result = await upsertScrapedPosts("acct-1", [post]);

    expect(result).toEqual({ found: 1, inserted: 0 });
    const updateArgs = updateChain.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArgs).toHaveProperty("media_urls", post.mediaUrls);
    expect(updateArgs).not.toHaveProperty("processing_status");
    expect(updateArgs).not.toHaveProperty("content_hash");
    expect(updateArgs).not.toHaveProperty("caption");
  });

  it("re-queues for processing when the caption changed", async () => {
    const post = scrapedPost({ caption: "Updated caption!" });
    const staleHash = computeContentHash("Old caption", post.postedAt);
    const selectChain = chain({ data: [{ id: "row-1", external_id: "123", content_hash: staleHash }], error: null });
    const updateChain = chain({ error: null });
    fromMock.mockReturnValueOnce(selectChain).mockReturnValueOnce(updateChain);

    const result = await upsertScrapedPosts("acct-1", [post]);

    expect(result).toEqual({ found: 1, inserted: 0 });
    const updateArgs = updateChain.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArgs).toMatchObject({
      caption: "Updated caption!",
      processing_status: "pending",
      processing_attempts: 0,
      processing_error: null,
    });
  });

  it("inserts new posts as pending, or skipped when there's no caption", async () => {
    const withContent = scrapedPost();
    // Media alone is not enough: extraction is text-only.
    const empty = scrapedPost({ instagramPostId: "999", caption: "   " });
    const selectChain = chain({ data: [], error: null });
    const insertChain1 = chain({ error: null });
    const insertChain2 = chain({ error: null });
    fromMock.mockReturnValueOnce(selectChain).mockReturnValueOnce(insertChain1).mockReturnValueOnce(insertChain2);

    const result = await upsertScrapedPosts("acct-1", [withContent, empty]);

    expect(result).toEqual({ found: 2, inserted: 2 });
    expect(insertChain1.insert.mock.calls[0][0]).toMatchObject({ processing_status: "pending" });
    expect(insertChain2.insert.mock.calls[0][0]).toMatchObject({ processing_status: "skipped" });
  });
});
