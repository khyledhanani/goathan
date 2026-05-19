export const dayKey = (now: number): string => {
  const d = new Date(now);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const weekKey = (now: number): string => {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

export const periodKeyFor = (
  frequency: "DAILY" | "WEEKLY",
  now: number,
): string => (frequency === "DAILY" ? dayKey(now) : weekKey(now));

export const weekStartMs = (now: number): number => {
  const d = new Date(now);
  const day = d.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - daysFromMonday,
    0,
    0,
    0,
  );
};

export const weekEndMs = (now: number): number =>
  weekStartMs(now) + 7 * 24 * 60 * 60 * 1000;

export const previousWeekKey = (now: number): string =>
  weekKey(weekStartMs(now) - 1);

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
};

export type PeriodBounds = {
  periodStart: number;
  periodEnd: number;
  periodKey: string;
  ended: boolean;
};

function defaultAnchor(createdAt?: number): number {
  return weekStartMs(createdAt ?? Date.now());
}

// ---- Monthly helpers ----

function monthStart(anchorDay: number, year: number, month: number): number {
  const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(anchorDay, maxDay));
}

function addMonths(anchorDay: number, baseYear: number, baseMonth: number, n: number): number {
  const m = baseMonth + n;
  const y = baseYear + Math.floor(m / 12);
  const mo = ((m % 12) + 12) % 12;
  return monthStart(anchorDay, y, mo);
}

function monthlyBounds(
  anchor: number,
  repeat: boolean,
  now: number,
  explicitDay?: number,
): PeriodBounds {
  const ad = new Date(anchor);
  const anchorDay = explicitDay ?? ad.getUTCDate();
  const anchorYear = ad.getUTCFullYear();
  const anchorMonth = ad.getUTCMonth();

  if (now < anchor) {
    const periodEnd = addMonths(anchorDay, anchorYear, anchorMonth, 1);
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
  let periodEnd = addMonths(anchorDay, anchorYear, anchorMonth, 1);

  while (periodEnd <= now) {
    periodIndex++;
    periodStart = periodEnd;
    periodEnd = addMonths(anchorDay, anchorYear, anchorMonth, periodIndex + 1);
  }

  if (!repeat && periodIndex >= 1) {
    const firstEnd = addMonths(anchorDay, anchorYear, anchorMonth, 1);
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
  explicitDay?: number,
): PeriodBounds | null {
  const current = monthlyBounds(anchor, repeat, now, explicitDay);
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
      : addMonths(anchorDay, anchorYear, anchorMonth, prevIndex);
  const prevEnd = addMonths(anchorDay, anchorYear, anchorMonth, prevIndex + 1);

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
  const anchor = group.anchorDate ?? defaultAnchor(group.createdAt);
  const repeat = group.repeat ?? true;

  if (group.cadence === "monthly") {
    return monthlyBounds(anchor, repeat, now, group.anchorDayOfMonth);
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
  const anchor = group.anchorDate ?? defaultAnchor(group.createdAt);
  const repeat = group.repeat ?? true;

  if (group.cadence === "monthly") {
    return previousMonthlyBounds(anchor, repeat, now, group.anchorDayOfMonth);
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
