import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PostRow } from "@/lib/types";

const getPost = vi.fn();
const markPost = vi.fn();
const claimPendingPosts = vi.fn();
const getAccountWithClub = vi.fn();
const insertEvent = vi.fn();
const updateEvent = vi.fn();
const getEvent = vi.fn();
const findDedupeCandidates = vi.fn();
const analyzeInstagramPost = vi.fn();
const normalizeExtraction = vi.fn();
const findDuplicate = vi.fn();

vi.mock("@/lib/db/repositories/posts", () => ({
  getPost: (...args: unknown[]) => getPost(...args),
  markPost: (...args: unknown[]) => markPost(...args),
  claimPendingPosts: (...args: unknown[]) => claimPendingPosts(...args),
}));
vi.mock("@/lib/db/repositories/accounts", () => ({
  getAccountWithClub: (...args: unknown[]) => getAccountWithClub(...args),
}));
vi.mock("@/lib/db/repositories/events", () => ({
  insertEvent: (...args: unknown[]) => insertEvent(...args),
  updateEvent: (...args: unknown[]) => updateEvent(...args),
  getEvent: (...args: unknown[]) => getEvent(...args),
  findDedupeCandidates: (...args: unknown[]) => findDedupeCandidates(...args),
}));
vi.mock("@/lib/ai/gemini", () => ({
  analyzeInstagramPost: (...args: unknown[]) => analyzeInstagramPost(...args),
}));
vi.mock("@/lib/events/normalize", () => ({
  normalizeExtraction: (...args: unknown[]) => normalizeExtraction(...args),
}));
vi.mock("@/lib/events/dedupe", () => ({
  findDuplicate: (...args: unknown[]) => findDuplicate(...args),
}));

const { processPost } = await import("./processPost");

function basePost(overrides: Partial<PostRow> = {}): PostRow {
  return {
    id: "post-1",
    source_id: "acct-1",
    provider: "instagram",
    external_id: "12345",
    canonical_url: "https://www.instagram.com/p/abc/",
    caption: "Come to our event!",
    media_urls: ["https://cdn.example.com/a.jpg"],
    published_at: "2026-09-20T00:00:00.000Z",
    content_hash: "hash",
    raw_payload: {},
    event_id: null,
    processing_status: "pending",
    processing_error: null,
    processing_attempts: 0,
    processing_started_at: null,
    processed_at: null,
    ai_result: null,
    first_seen_at: "2026-09-20T00:00:00.000Z",
    last_seen_at: "2026-09-20T00:00:00.000Z",
    ...overrides,
  };
}

const club = { id: "club-1", name: "UBC Game Dev", instagram_handle: "ubcgamedev", website_url: null, follower_count: 100, created_at: "", updated_at: "" };
const account = { id: "acct-1", handle: "ubcgamedev", display_name: "UBC Game Dev", club_id: "club-1" };

beforeEach(() => {
  vi.clearAllMocks();
  getAccountWithClub.mockResolvedValue({ account, club });
});

describe("processPost", () => {
  it("skips a post with no caption without calling Gemini", async () => {
    getPost.mockResolvedValue(basePost({ caption: "  " }));

    const result = await processPost("post-1");

    expect(result.status).toBe("skipped");
    expect(analyzeInstagramPost).not.toHaveBeenCalled();
    expect(markPost).toHaveBeenLastCalledWith("post-1", expect.objectContaining({ processing_status: "skipped" }));
  });

  it("sends only the trimmed caption text to Gemini", async () => {
    getPost.mockResolvedValue(basePost({ caption: "  Come to our event!  " }));
    analyzeInstagramPost.mockRejectedValue(new Error("stop here"));

    await processPost("post-1");

    const input = analyzeInstagramPost.mock.calls[0][0];
    expect(input.caption).toBe("Come to our event!");
    expect(input).not.toHaveProperty("images");
  });

  it("marks pending when AI throws and attempts < 3", async () => {
    getPost.mockResolvedValue(basePost({ processing_attempts: 1 }));
    analyzeInstagramPost.mockRejectedValue(new Error("gemini down"));

    const result = await processPost("post-1");

    expect(result.status).toBe("failed");
    expect(markPost).toHaveBeenCalledWith("post-1", expect.objectContaining({ processing_status: "pending" }));
  });

  it("marks failed when AI throws and attempts >= 3", async () => {
    getPost.mockResolvedValue(basePost({ processing_attempts: 3 }));
    analyzeInstagramPost.mockRejectedValue(new Error("gemini down"));

    const result = await processPost("post-1", { force: true });

    expect(result.status).toBe("failed");
    expect(markPost).toHaveBeenCalledWith("post-1", expect.objectContaining({ processing_status: "failed" }));
  });

  it("returns not_event without creating an event", async () => {
    getPost.mockResolvedValue(basePost());
    analyzeInstagramPost.mockResolvedValue({ extraction: { is_event: false }, model: "gemini-test" });
    normalizeExtraction.mockReturnValue({ kind: "not_event" });

    const result = await processPost("post-1");

    expect(result.status).toBe("not_event");
    expect(insertEvent).not.toHaveBeenCalled();
    expect(markPost).toHaveBeenCalledWith(
      "post-1",
      expect.objectContaining({ processing_status: "processed", processing_error: null }),
    );
  });

  it("merges into an existing dedupe candidate", async () => {
    const normalizedEvent = {
      name: "Game Jam",
      organization: null,
      description: "desc",
      startsAt: "2026-10-01T00:00:00.000Z",
      endsAt: null,
      hasStartTime: true,
      timezone: "America/Vancouver",
      location: null,
      registrationUrl: null,
      priceLabel: null,
      priceCents: null,
      isFree: true,
      freeFood: false,
      tags: ["gamedev"],
      confidence: 0.9,
      evidence: ["says game jam"],
      status: "published" as const,
    };
    getPost.mockResolvedValue(basePost());
    analyzeInstagramPost.mockResolvedValue({ extraction: { is_event: true }, model: "gemini-test" });
    normalizeExtraction.mockReturnValue({ kind: "event", event: normalizedEvent });
    findDedupeCandidates.mockResolvedValue([{ id: "evt-existing", name: "Game Jam", starts_at: normalizedEvent.startsAt, location: null, timezone: "America/Vancouver" }]);
    findDuplicate.mockReturnValue("evt-existing");
    getEvent.mockResolvedValue({
      id: "evt-existing",
      club_id: "club-1",
      source_item_id: "other-post",
      name: "Game Jam",
      organization: null,
      description: "",
      starts_at: normalizedEvent.startsAt,
      ends_at: null,
      has_start_time: true,
      timezone: "America/Vancouver",
      location: null,
      registration_url: null,
      price_label: null,
      price_cents: null,
      is_free: false,
      free_food: false,
      tags: ["fun"],
      popularity_score: 0,
      status: "needs_review",
      source_url: "https://www.instagram.com/p/old/",
      source_content_hash: "old-hash",
      ai_confidence: 0.5,
      ai_evidence: ["old evidence"],
      last_scraped_at: "2026-09-01T00:00:00.000Z",
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z",
    });
    updateEvent.mockResolvedValue({ id: "evt-existing" });

    const result = await processPost("post-1");

    expect(result.status).toBe("event_merged");
    expect(result.event_id).toBe("evt-existing");
    expect(insertEvent).not.toHaveBeenCalled();
    const patch = updateEvent.mock.calls[0][1];
    expect(patch.status).toBe("published"); // incoming would publish -> merged event publishes
    expect(patch.starts_at).toBe(normalizedEvent.startsAt); // existing had it too, unchanged
    expect(patch.tags).toEqual(expect.arrayContaining(["fun", "gamedev"]));
  });

  it("creates a new event when no dedupe match exists", async () => {
    const normalizedEvent = {
      name: "Workshop",
      organization: "UBC Game Dev",
      description: "desc",
      startsAt: "2026-10-05T00:00:00.000Z",
      endsAt: null,
      hasStartTime: true,
      timezone: "America/Vancouver",
      location: "Room 101",
      registrationUrl: null,
      priceLabel: null,
      priceCents: null,
      isFree: true,
      freeFood: true,
      tags: ["workshop"],
      confidence: 0.95,
      evidence: ["clear event"],
      status: "published" as const,
    };
    getPost.mockResolvedValue(basePost());
    analyzeInstagramPost.mockResolvedValue({ extraction: { is_event: true }, model: "gemini-test" });
    normalizeExtraction.mockReturnValue({ kind: "event", event: normalizedEvent });
    findDedupeCandidates.mockResolvedValue([]);
    findDuplicate.mockReturnValue(null);
    insertEvent.mockResolvedValue({ id: "evt-new" });

    const result = await processPost("post-1");

    expect(result.status).toBe("event_created");
    expect(result.event_id).toBe("evt-new");
    expect(insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Workshop", club_id: "club-1", source_item_id: "post-1" }),
    );
  });
});
