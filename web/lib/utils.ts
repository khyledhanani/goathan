export const titleCase = (s: string): string =>
  s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

export const firstName = (full: string): string => full.trim().split(/\s+/)[0] ?? full;
