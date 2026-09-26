export type BackoffOptions = {
  baseMs: number;
  maxMs: number;
  /** Fraction of the delay randomized away, 0..1. Spreads retries so they don't arrive in lockstep. */
  jitter?: number;
  random?: () => number;
};

/** Exponential backoff: attempt 1 -> baseMs, attempt 2 -> 2*baseMs, ... capped at maxMs, minus up to `jitter` of it. */
export function backoffDelayMs(attempt: number, { baseMs, maxMs, jitter = 0.2, random = Math.random }: BackoffOptions): number {
  const exponential = baseMs * 2 ** Math.max(0, attempt - 1);
  const capped = Math.min(maxMs, exponential);
  return Math.round(capped * (1 - jitter * random()));
}

/** Parses a Retry-After header (delta-seconds or HTTP date) into seconds; null when absent/unparseable. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - now) / 1000));
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
