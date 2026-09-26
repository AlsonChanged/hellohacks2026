import type { NormalizedEvent } from "@/lib/types";
import { localParts } from "@/lib/utils/dates";

export type DedupeCandidate = { id: string; name: string; starts_at: string | null; location: string | null; timezone: string };

const FILLER = new Set(["the", "a", "an", "annual", "our", "ubc"]);
const LOCATION_FILLER = new Set(["the", "a", "an", "at", "ubc", "room", "rm", "building", "bldg", "floor", "vancouver", "campus"]);
const STRONG_JACCARD = 0.7;
const MIN_JACCARD = 0.5;
const CONTAINMENT_SCORE = 0.75;

function tokenize(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Lowercase, strip accents/emoji/punctuation, drop years (2000-2099) and filler words, collapse whitespace. */
export function normalizeTitle(title: string): string {
  return tokenize(title)
    .filter((t) => !FILLER.has(t) && !/^20\d\d$/.test(t))
    .join(" ");
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function isSubset(a: Set<string>, b: Set<string>): boolean {
  for (const t of a) if (!b.has(t)) return false;
  return true;
}

function localDateKey(iso: string, timeZone: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = localParts(d, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

function locationsOverlap(a: string, b: string): boolean {
  const ta = new Set(tokenize(a).filter((t) => !LOCATION_FILLER.has(t)));
  return tokenize(b).some((t) => !LOCATION_FILLER.has(t) && ta.has(t));
}

/**
 * A candidate is a duplicate when it falls on the same local calendar date (in the new event's
 * timezone) and the normalized titles are equal, have token Jaccard >= 0.5, or one title's tokens
 * contain the other's. A match resting only on Jaccard in [0.5, 0.7) additionally needs overlapping
 * location tokens, so both sides must have a location. Returns the highest-scoring candidate id.
 */
export function findDuplicate(event: NormalizedEvent, existing: DedupeCandidate[]): string | null {
  if (!event.startsAt) return null;
  const day = localDateKey(event.startsAt, event.timezone);
  const title = normalizeTitle(event.name);
  const tokens = new Set(title.split(" ").filter(Boolean));
  if (!day || tokens.size === 0) return null;

  let best: { id: string; score: number } | null = null;
  for (const c of existing) {
    if (!c.starts_at || localDateKey(c.starts_at, event.timezone) !== day) continue;
    const other = normalizeTitle(c.name);
    const otherTokens = new Set(other.split(" ").filter(Boolean));
    if (otherTokens.size === 0) continue;

    const j = jaccard(tokens, otherTokens);
    const contains = isSubset(tokens, otherTokens) || isSubset(otherTokens, tokens);
    let score: number;
    if (other === title) score = 1;
    else if (j >= STRONG_JACCARD) score = j;
    else if (contains) score = Math.max(j, CONTAINMENT_SCORE);
    else if (j >= MIN_JACCARD) {
      // A weak title match alone merges look-alikes ("Intro to Godot Workshop" vs "Intro to Unity
      // Workshop"), so it only counts when both posts name an overlapping location.
      if (!event.location || !c.location || !locationsOverlap(event.location, c.location)) continue;
      score = j;
    } else continue;

    if (!best || score > best.score) best = { id: c.id, score };
  }
  return best?.id ?? null;
}
