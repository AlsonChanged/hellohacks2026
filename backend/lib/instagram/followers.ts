// Parses Instagram's various follower-count representations into a plain integer.

const SUFFIX_MULTIPLIERS: Record<string, number> = { k: 1_000, m: 1_000_000, b: 1_000_000_000 };

export function parseFollowerCount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  const match = trimmed.match(/^([\d,]*\.?\d+)\s*([kmb])?\b/);
  if (!match) return null;

  const numeric = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(numeric) || numeric < 0) return null;

  const suffix = match[2];
  const multiplier = suffix ? SUFFIX_MULTIPLIERS[suffix] : 1;

  return Math.round(numeric * multiplier);
}
