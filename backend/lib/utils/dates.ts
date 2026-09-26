export type WallTime = { year: number; month: number; day: number; hour: number; minute: number };
export type LocalParts = WallTime & { weekday: string };

const ACTIVE_WINDOW_MONTHS = 6;
const DAY_MS = 86_400_000;

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isValidDate(year: number, month: number, day: number): boolean {
  return Number.isInteger(year) && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** Subtracts calendar months in UTC, clamping to month end (Aug 31 − 6 months = Feb 28/29). */
export function subtractMonths(date: Date, months: number): Date {
  const total = date.getUTCFullYear() * 12 + date.getUTCMonth() - months;
  const year = Math.floor(total / 12);
  const monthIndex = total - year * 12;
  const day = Math.min(date.getUTCDate(), daysInMonth(year, monthIndex + 1));
  return new Date(
    Date.UTC(
      year,
      monthIndex,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

/** Active iff the most recent post is strictly newer than now minus 6 calendar months. */
export function isAccountActive(mostRecentPostAt: Date | null, now: Date = new Date()): boolean {
  if (!mostRecentPostAt || Number.isNaN(mostRecentPostAt.getTime())) return false;
  return mostRecentPostAt.getTime() > subtractMonths(now, ACTIVE_WINDOW_MONTHS).getTime();
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "long",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Local wall-clock parts of an instant in an IANA zone. */
export function localParts(date: Date, timeZone: string): LocalParts & { second: number } {
  const out: Record<string, string> = {};
  for (const p of formatterFor(timeZone).formatToParts(date)) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: out.weekday,
  };
}

/** Zone offset (local − UTC) in ms at the given instant. */
function offsetAt(ms: number, timeZone: string): number {
  const p = localParts(new Date(ms), timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/**
 * Local wall time in `timeZone` -> UTC instant, using only Intl.
 * Spring-forward gap (e.g. 02:30 on 2026-03-08 in Vancouver): shifted forward by the gap (-> 03:30 PDT).
 * Fall-back overlap (01:30 on 2026-11-01): the earlier instant (PDT).
 */
export function zonedWallTimeToUtc(p: WallTime, timeZone: string): Date {
  const guess = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  // Offsets a day either side bracket any single transition near this wall time.
  const before = offsetAt(guess - DAY_MS, timeZone);
  const after = offsetAt(guess + DAY_MS, timeZone);
  const matches = [guess - before, guess - after].filter((t) => {
    const l = localParts(new Date(t), timeZone);
    return l.year === p.year && l.month === p.month && l.day === p.day && l.hour === p.hour && l.minute === p.minute;
  });
  if (matches.length > 0) return new Date(Math.min(...matches));
  // Wall time does not exist: interpret with the pre-transition offset, which lands after the gap.
  return new Date(guess - before);
}

/** Day ordinal for comparing calendar dates without time zones. */
export function dayNumber(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}
