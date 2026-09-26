import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ScrapeError } from "@/lib/types";
import { WebProfileScraper } from "./webScraper";

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, "__fixtures__", name), "utf-8"));
}

function jsonResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json", ...init?.headers },
  });
}

const noSleep = async () => {};

describe("WebProfileScraper", () => {
  it("returns a normalized account for a public profile", async () => {
    const fetchImpl = async () => jsonResponse(loadFixture("public-profile.json"));
    const scraper = new WebProfileScraper({ sleep: noSleep, fetchImpl: fetchImpl as unknown as typeof fetch });

    const account = await scraper.getAccount("@ubcgamedev");
    expect(account.username).toBe("ubcgamedev");
    expect(account.posts).toHaveLength(2);
  });

  it("returns a private account without throwing", async () => {
    const fetchImpl = async () => jsonResponse(loadFixture("private-profile.json"));
    const scraper = new WebProfileScraper({ sleep: noSleep, fetchImpl: fetchImpl as unknown as typeof fetch });

    const account = await scraper.getAccount("someprivateclub");
    expect(account.isPrivate).toBe(true);
    expect(account.posts).toEqual([]);
    expect(account.mostRecentPostAt).toBeNull();
  });

  it("classifies a 404 as not_found", async () => {
    const fetchImpl = async () => jsonResponse({ message: "not found" }, { status: 404 });
    const scraper = new WebProfileScraper({ sleep: noSleep, fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(scraper.getAccount("ghost")).rejects.toMatchObject({
      status: "not_found",
    } satisfies Partial<ScrapeError>);
  });

  it("classifies data.user === null as not_found", async () => {
    const fetchImpl = async () => jsonResponse(loadFixture("not-found.json"));
    const scraper = new WebProfileScraper({ sleep: noSleep, fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(scraper.getAccount("ghost")).rejects.toThrow(ScrapeError);
    try {
      await scraper.getAccount("ghost");
      expect.unreachable();
    } catch (err) {
      expect((err as ScrapeError).status).toBe("not_found");
    }
  });

  it("classifies a 429 as error with retryAfterSeconds from the header", async () => {
    const fetchImpl = async () =>
      jsonResponse({ message: "rate limited" }, { status: 429, headers: { "retry-after": "120" } });
    const scraper = new WebProfileScraper({ sleep: noSleep, fetchImpl: fetchImpl as unknown as typeof fetch });

    try {
      await scraper.getAccount("ubcgamedev");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ScrapeError);
      expect((err as ScrapeError).status).toBe("error");
      expect((err as ScrapeError).retryAfterSeconds).toBe(120);
    }
  });

  it("defaults retryAfterSeconds to 3600 on a 429 with no Retry-After header", async () => {
    const fetchImpl = async () => jsonResponse({ message: "rate limited" }, { status: 429 });
    const scraper = new WebProfileScraper({ sleep: noSleep, fetchImpl: fetchImpl as unknown as typeof fetch });

    try {
      await scraper.getAccount("ubcgamedev");
      expect.unreachable();
    } catch (err) {
      expect((err as ScrapeError).retryAfterSeconds).toBe(3600);
    }
  });

  it("classifies an HTML login-page response as error", async () => {
    const fetchImpl = async () =>
      new Response("<html><body>Log in to Instagram</body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    const scraper = new WebProfileScraper({ sleep: noSleep, fetchImpl: fetchImpl as unknown as typeof fetch });

    try {
      await scraper.getAccount("ubcgamedev");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ScrapeError);
      expect((err as ScrapeError).status).toBe("error");
      expect((err as ScrapeError).message).toMatch(/rate limited|login required/i);
    }
  });

  it("classifies a network failure as error", async () => {
    const fetchImpl = async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    };
    const scraper = new WebProfileScraper({ sleep: noSleep, fetchImpl: fetchImpl as unknown as typeof fetch });

    try {
      await scraper.getAccount("ubcgamedev");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ScrapeError);
      expect((err as ScrapeError).status).toBe("error");
    }
  });

  it("sends the expected request headers, including sessionid when configured", async () => {
    let capturedHeaders: Headers | undefined;
    let capturedUrl: string | undefined;
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedHeaders = new Headers(init?.headers);
      return jsonResponse(loadFixture("public-profile.json"));
    };
    const scraper = new WebProfileScraper({
      sessionId: "abc123",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await scraper.getAccount("ubcgamedev");

    expect(capturedUrl).toBe("https://www.instagram.com/api/v1/users/web_profile_info/?username=ubcgamedev");
    expect(capturedHeaders?.get("x-ig-app-id")).toBe("936619743392459");
    expect(capturedHeaders?.get("referer")).toBe("https://www.instagram.com/ubcgamedev/");
    expect(capturedHeaders?.get("cookie")).toBe("sessionid=abc123");
  });
});

describe("WebProfileScraper retries", () => {
  // Returns each response in turn, repeating the last one.
  function sequence(...responses: (() => Response)[]) {
    let call = 0;
    const fetchImpl = vi.fn(async () => responses[Math.min(call++, responses.length - 1)]());
    return fetchImpl;
  }
  const ok = () => jsonResponse(loadFixture("public-profile.json"));
  const rateLimited = () => jsonResponse({ message: "rate limited" }, { status: 429 });
  const serverError = () => new Response("oops", { status: 503 });

  it("retries a 429 with exponential backoff and then succeeds", async () => {
    const fetchImpl = sequence(rateLimited, rateLimited, ok);
    const sleep = vi.fn(async () => {});
    const scraper = new WebProfileScraper({ fetchImpl: fetchImpl as unknown as typeof fetch, sleep });

    const account = await scraper.getAccount("ubcgamedev");

    expect(account.username).toBeTruthy();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const [first, second] = sleep.mock.calls.map((c) => (c as unknown as [number])[0]);
    expect(first).toBeGreaterThan(1000); // ~2s minus jitter
    expect(first).toBeLessThanOrEqual(2000);
    expect(second).toBeGreaterThan(3000); // ~4s minus jitter
    expect(second).toBeLessThanOrEqual(4000);
  });

  it("retries 5xx and network errors", async () => {
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call++;
      if (call === 1) throw new TypeError("fetch failed");
      if (call === 2) return serverError();
      return ok();
    });
    const scraper = new WebProfileScraper({ fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep });

    await expect(scraper.getAccount("ubcgamedev")).resolves.toBeTruthy();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("gives up after maxAttempts and flags the rate limit for the scheduler", async () => {
    const fetchImpl = sequence(rateLimited);
    const scraper = new WebProfileScraper({ fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep });

    const err = (await scraper.getAccount("ubcgamedev").catch((e) => e)) as ScrapeError;

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(err).toBeInstanceOf(ScrapeError);
    expect(err.rateLimited).toBe(true);
    expect(err.retryAfterSeconds).toBe(3600);
  });

  it("waits out a short Retry-After instead of its own backoff", async () => {
    const fetchImpl = sequence(() => jsonResponse({}, { status: 429, headers: { "retry-after": "3" } }), ok);
    const sleep = vi.fn(async () => {});
    const scraper = new WebProfileScraper({ fetchImpl: fetchImpl as unknown as typeof fetch, sleep });

    await scraper.getAccount("ubcgamedev");

    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it("does not wait out a long Retry-After in-request", async () => {
    const fetchImpl = sequence(() => jsonResponse({}, { status: 429, headers: { "retry-after": "120" } }));
    const sleep = vi.fn(async () => {});
    const scraper = new WebProfileScraper({ fetchImpl: fetchImpl as unknown as typeof fetch, sleep });

    const err = (await scraper.getAccount("ubcgamedev").catch((e) => e)) as ScrapeError;

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(err.retryAfterSeconds).toBe(120);
  });

  it("does not retry login walls, but flags them as rate limited", async () => {
    const fetchImpl = sequence(() => jsonResponse({}, { status: 401 }));
    const scraper = new WebProfileScraper({ fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep });

    const err = (await scraper.getAccount("ubcgamedev").catch((e) => e)) as ScrapeError;

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(err.rateLimited).toBe(true);
  });

  it("does not retry not-found", async () => {
    const fetchImpl = sequence(() => jsonResponse({}, { status: 404 }));
    const scraper = new WebProfileScraper({ fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep });

    const err = (await scraper.getAccount("ubcgamedev").catch((e) => e)) as ScrapeError;

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(err.status).toBe("not_found");
  });
});
