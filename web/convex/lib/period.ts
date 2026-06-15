// ---------------------------------------------------------------------------
// Timezone-aware period helpers
//
// Group reset logic (daily/weekly task keys, competition round bounds, and the
// reset countdowns) is computed in the *group's* timezone. Functions accept an
// IANA `timeZone` string; it defaults to "UTC" so any caller that omits it keeps
// the historical behavior. Resolve a group's zone with `groupTimeZone(group)`,
// which falls back to DEFAULT_TIMEZONE for groups created before this field
// existed.
// ---------------------------------------------------------------------------

export const DEFAULT_TIMEZONE = "America/Toronto";

export function groupTimeZone(
  group: { timezone?: string } | null | undefined,
): string {
  return group?.timezone ?? DEFAULT_TIMEZONE;
}

const pad = (n: number) => String(n).padStart(2, "0");

// Wall-clock Y/M/D h:m:s for an instant, as seen in `timeZone`.
function zonedYmdHms(ms: number, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return {
    y: get("year"),
    m: get("month"),
    d: get("day"),
    h: get("hour"),
    min: get("minute"),
    s: get("second"),
  };
}

// Signed offset (ms east of UTC) of `timeZone` at the given instant.
function zoneOffsetMs(ms: number, timeZone: string): number {
  const p = zonedYmdHms(ms, timeZone);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  return asUtc - ms;
}

// UTC ms of wall-clock midnight for (y, m1based, d) in `timeZone`.
// Offset is sampled at the guessed instant — correct except across the rare DST
// flip landing exactly at midnight, which is acceptable for reset boundaries.
function zoneMidnightFromYmd(
  y: number,
  m1: number,
  d: number,
  timeZone: string,
): number {
  const guess = Date.UTC(y, m1 - 1, d, 0, 0, 0);
  return guess - zoneOffsetMs(guess, timeZone);
}

// UTC ms of the start of the zone-local day containing `ms`.
export function zonedDayStartMs(ms: number, timeZone: string): number {
  const p = zonedYmdHms(ms, timeZone);
  return zoneMidnightFromYmd(p.y, p.m, p.d, timeZone);
}

// UTC ms of the next zone-local midnight after `ms` — the daily reset boundary.
export function nextZonedMidnightMs(ms: number, timeZone: string): number {
  const start = zonedDayStartMs(ms, timeZone);
  // +25h lands in the following local day even if DST shortened today, then
  // snap back to that day's start.
  return zonedDayStartMs(start + 25 * 3_600_000, timeZone);
}

// Re-anchor a UTC-midnight calendar day (what the client sends) to that same
// calendar day's midnight *in the zone*. Keeps the chosen Y/M/D, fixes the time.
export function snapUtcDayToZoneMidnight(ms: number, timeZone: string): number {
  const d = new Date(ms);
  return zoneMidnightFromYmd(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    timeZone,
  );
}

export const dayKey = (now: number, timeZone: string = "UTC"): string => {
  const p = zonedYmdHms(now, timeZone);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
};

export const weekKey = (now: number, timeZone: string = "UTC"): string => {
  const p = zonedYmdHms(now, timeZone);
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d));
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad(weekNo)}`;
};

export const periodKeyFor = (
  frequency: "DAILY" | "WEEKLY",
  now: number,
  timeZone: string = "UTC",
): string => (frequency === "DAILY" ? dayKey(now, timeZone) : weekKey(now, timeZone));

export const weekStartMs = (now: number, timeZone: string = "UTC"): number => {
  const p = zonedYmdHms(now, timeZone);
  const dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  const daysFromMonday = (dow + 6) % 7;
  return zoneMidnightFromYmd(p.y, p.m, p.d - daysFromMonday, timeZone);
};

export const weekEndMs = (now: number, timeZone: string = "UTC"): number =>
  weekStartMs(now, timeZone) + 7 * 24 * 60 * 60 * 1000;

export const previousWeekKey = (now: number, timeZone: string = "UTC"): string =>
  weekKey(weekStartMs(now, timeZone) - 1, timeZone);

export const previousDayKey = (key: string): string => {
  const [y, m, d] = key.split("-").map((s) => Number(s));
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};

// ---------------------------------------------------------------------------
// Per-group competition periods
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

export type PeriodConfig = {
  anchorDate?: number;
  anchorDayOfMonth?: number;
  durationDays?: number;
  repeat?: boolean;
  cadence?: "monthly";
  createdAt?: number;
  timezone?: string;
};

export type PeriodBounds = {
  periodStart: number;
  periodEnd: number;
  periodKey: string;
  ended: boolean;
};

function defaultAnchor(createdAt: number | undefined, timeZone: string): number {
  return weekStartMs(createdAt ?? Date.now(), timeZone);
}

// ---- Monthly helpers ----

function monthStart(
  anchorDay: number,
  year: number,
  month: number,
  timeZone: string,
): number {
  const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return zoneMidnightFromYmd(year, month + 1, Math.min(anchorDay, maxDay), timeZone);
}

function addMonths(
  anchorDay: number,
  baseYear: number,
  baseMonth: number,
  n: number,
  timeZone: string,
): number {
  const m = baseMonth + n;
  const y = baseYear + Math.floor(m / 12);
  const mo = ((m % 12) + 12) % 12;
  return monthStart(anchorDay, y, mo, timeZone);
}

function monthlyBounds(
  anchor: number,
  repeat: boolean,
  now: number,
  timeZone: string,
  explicitDay?: number,
): PeriodBounds {
  const ad = new Date(anchor);
  const anchorDay = explicitDay ?? ad.getUTCDate();
  const anchorYear = ad.getUTCFullYear();
  const anchorMonth = ad.getUTCMonth();

  if (now < anchor) {
    const periodEnd = addMonths(anchorDay, anchorYear, anchorMonth, 1, timeZone);
    return {
      periodStart: anchor,
      periodEnd,
      periodKey: `M-${anchor}-0`,
      ended: false,
    };
  }

  // Find which monthly period we're in by scanning forward
  let periodIndex = 0;
  let periodStart = anchor;
  let periodEnd = addMonths(anchorDay, anchorYear, anchorMonth, 1, timeZone);

  while (periodEnd <= now) {
    periodIndex++;
    periodStart = periodEnd;
    periodEnd = addMonths(anchorDay, anchorYear, anchorMonth, periodIndex + 1, timeZone);
  }

  if (!repeat && periodIndex >= 1) {
    const firstEnd = addMonths(anchorDay, anchorYear, anchorMonth, 1, timeZone);
    return {
      periodStart: anchor,
      periodEnd: firstEnd,
      periodKey: `M-${anchor}-0`,
      ended: true,
    };
  }

  return {
    periodStart,
    periodEnd,
    periodKey: `M-${anchor}-${periodIndex}`,
    ended: false,
  };
}

function previousMonthlyBounds(
  anchor: number,
  repeat: boolean,
  now: number,
  timeZone: string,
  explicitDay?: number,
): PeriodBounds | null {
  const current = monthlyBounds(anchor, repeat, now, timeZone, explicitDay);
  const key = current.periodKey;
  const idx = parseInt(key.split("-").pop()!, 10);

  if (idx < 1) return null;
  if (!repeat && idx > 1) return null;

  const ad = new Date(anchor);
  const anchorDay = explicitDay ?? ad.getUTCDate();
  const anchorYear = ad.getUTCFullYear();
  const anchorMonth = ad.getUTCMonth();

  const prevIndex = idx - 1;
  const prevStart =
    prevIndex === 0
      ? anchor
      : addMonths(anchorDay, anchorYear, anchorMonth, prevIndex, timeZone);
  const prevEnd = addMonths(anchorDay, anchorYear, anchorMonth, prevIndex + 1, timeZone);

  return {
    periodStart: prevStart,
    periodEnd: prevEnd,
    periodKey: `M-${anchor}-${prevIndex}`,
    ended: true,
  };
}

// ---- Public API ----

export function groupPeriodBounds(
  group: PeriodConfig,
  now: number,
): PeriodBounds {
  const timeZone = groupTimeZone(group);
  const anchor = group.anchorDate ?? defaultAnchor(group.createdAt, timeZone);
  const repeat = group.repeat ?? true;

  if (group.cadence === "monthly") {
    return monthlyBounds(anchor, repeat, now, timeZone, group.anchorDayOfMonth);
  }

  const duration = (group.durationDays ?? 7) * DAY_MS;

  if (now < anchor) {
    return {
      periodStart: anchor,
      periodEnd: anchor + duration,
      periodKey: `P-${anchor}-0`,
      ended: false,
    };
  }

  const elapsed = now - anchor;
  const periodIndex = Math.floor(elapsed / duration);

  if (!repeat && periodIndex >= 1) {
    return {
      periodStart: anchor,
      periodEnd: anchor + duration,
      periodKey: `P-${anchor}-0`,
      ended: true,
    };
  }

  const periodStart = anchor + periodIndex * duration;
  const periodEnd = periodStart + duration;
  return {
    periodStart,
    periodEnd,
    periodKey: `P-${anchor}-${periodIndex}`,
    ended: false,
  };
}

export function previousPeriodBounds(
  group: PeriodConfig,
  now: number,
): PeriodBounds | null {
  const timeZone = groupTimeZone(group);
  const anchor = group.anchorDate ?? defaultAnchor(group.createdAt, timeZone);
  const repeat = group.repeat ?? true;

  if (group.cadence === "monthly") {
    return previousMonthlyBounds(anchor, repeat, now, timeZone, group.anchorDayOfMonth);
  }

  const duration = (group.durationDays ?? 7) * DAY_MS;

  if (now < anchor) return null;

  const elapsed = now - anchor;
  const currentIndex = Math.floor(elapsed / duration);

  if (currentIndex < 1) return null;

  const prevIndex = currentIndex - 1;

  if (!repeat && prevIndex >= 1) return null;

  const periodStart = anchor + prevIndex * duration;
  const periodEnd = periodStart + duration;
  return {
    periodStart,
    periodEnd,
    periodKey: `P-${anchor}-${prevIndex}`,
    ended: true,
  };
}
