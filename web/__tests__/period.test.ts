import { describe, expect, it } from "vitest";
import {
  dayKey,
  groupPeriodBounds,
  previousDayKey,
  previousPeriodBounds,
  previousWeekKey,
  weekEndMs,
  weekKey,
  weekStartMs,
} from "../convex/lib/period";

describe("date period helpers", () => {
  it("uses UTC calendar days", () => {
    expect(dayKey(Date.UTC(2026, 0, 2, 23, 59))).toBe("2026-01-02");
    expect(previousDayKey("2026-01-01")).toBe("2025-12-31");
  });

  it("uses ISO-like week keys across year boundaries", () => {
    expect(weekKey(Date.UTC(2026, 0, 1))).toBe("2026-W01");
    expect(previousWeekKey(Date.UTC(2026, 0, 7))).toBe("2026-W01");
  });

  it("returns Monday UTC week boundaries", () => {
    const wednesday = Date.UTC(2026, 4, 20, 12);

    expect(weekStartMs(wednesday)).toBe(Date.UTC(2026, 4, 18));
    expect(weekEndMs(wednesday)).toBe(Date.UTC(2026, 4, 25));
  });
});

describe("groupPeriodBounds", () => {
  it("returns the active repeating fixed-duration period", () => {
    const anchorDate = Date.UTC(2026, 0, 1);
    const now = Date.UTC(2026, 0, 16);

    expect(groupPeriodBounds({ anchorDate, durationDays: 7, repeat: true }, now)).toEqual(
      {
        periodStart: Date.UTC(2026, 0, 15),
        periodEnd: Date.UTC(2026, 0, 22),
        periodKey: `P-${anchorDate}-2`,
        ended: false,
      },
    );
  });

  it("returns the previous period when one exists", () => {
    const anchorDate = Date.UTC(2026, 0, 1);
    const now = Date.UTC(2026, 0, 16);

    expect(
      previousPeriodBounds({ anchorDate, durationDays: 7, repeat: true }, now),
    ).toEqual({
      periodStart: Date.UTC(2026, 0, 8),
      periodEnd: Date.UTC(2026, 0, 15),
      periodKey: `P-${anchorDate}-1`,
      ended: true,
    });
  });

  it("clamps monthly anchors for shorter months", () => {
    const anchorDate = Date.UTC(2026, 0, 31);
    const now = Date.UTC(2026, 1, 28, 12);

    expect(groupPeriodBounds({ anchorDate, cadence: "monthly" }, now)).toEqual({
      periodStart: Date.UTC(2026, 1, 28),
      periodEnd: Date.UTC(2026, 2, 31),
      periodKey: `M-${anchorDate}-1`,
      ended: false,
    });
  });
});
