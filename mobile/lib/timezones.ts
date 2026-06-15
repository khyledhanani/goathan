// Common timezones offered for group reset calculations. The backend stores the
// IANA id (`id`, e.g. "America/Toronto") on the group and does all the math; the
// pill only shows the short region `label` (e.g. "ET"). Never store the label.

export const DEFAULT_TIMEZONE = "America/Toronto";

export type TimezoneOption = {
  /** IANA value saved on the group — this is what the DB stores. */
  id: string;
  /** Short region code shown on the pill (e.g. "ET"). */
  label: string;
  /** Full name for the subtle meaning line (e.g. "Eastern Time"). */
  name: string;
  /** Other IANA ids that should select this option (same region). */
  aliases?: string[];
};

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { id: "America/Toronto", label: "ET", name: "Eastern Time", aliases: ["America/New_York"] },
  { id: "America/Chicago", label: "CT", name: "Central Time" },
  { id: "America/Denver", label: "MT", name: "Mountain Time" },
  { id: "America/Los_Angeles", label: "PT", name: "Pacific Time" },
  { id: "Europe/London", label: "GMT", name: "Greenwich Mean Time" },
  { id: "Europe/Paris", label: "CET", name: "Central European Time" },
  { id: "UTC", label: "UTC", name: "Coordinated Universal Time" },
];

// Resolve a stored IANA id to its option, matching the canonical id or any alias
// so e.g. a group saved as "America/New_York" still maps to the ET pill.
export function timezoneOptionFor(
  id: string | null | undefined,
): TimezoneOption | undefined {
  if (!id) return undefined;
  return TIMEZONE_OPTIONS.find(
    (t) => t.id === id || t.aliases?.includes(id),
  );
}
