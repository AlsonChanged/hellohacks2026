// Accepts "@handle", "handle", or a profile URL and normalizes to a bare lowercase handle.

const HANDLE_RE = /^[a-z0-9._]{1,30}$/;
const RESERVED = new Set(["p", "reel", "reels", "explore", "stories", "accounts"]);

export function normalizeHandle(input: string): string {
  let value = (input ?? "").trim();
  if (!value) throw new Error("Instagram handle is empty");

  // Strip protocol + host if this looks like a URL.
  value = value.replace(/^https?:\/\//i, "");
  if (/^(www\.)?instagram\.com\//i.test(value)) {
    value = value.replace(/^(www\.)?instagram\.com\//i, "");
  }

  // Drop query string / hash, then take the first path segment.
  value = value.split(/[?#]/)[0];
  const segment = value.split("/").filter(Boolean)[0] ?? "";

  const handle = segment.replace(/^@/, "").toLowerCase();

  if (!HANDLE_RE.test(handle)) {
    throw new Error(`Invalid Instagram handle: "${input}"`);
  }
  if (RESERVED.has(handle)) {
    throw new Error(`"${handle}" is a reserved Instagram path, not a handle`);
  }

  return handle;
}

export function profileUrlFor(handle: string): string {
  return `https://www.instagram.com/${normalizeHandle(handle)}/`;
}
