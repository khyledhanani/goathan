import { ConvexError } from "convex/values";

const FALLBACK = "Something went wrong";

const trimToNull = (s: unknown): string | null => {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
};

export function errorMessage(e: unknown, fallback: string = FALLBACK): string {
  if (e instanceof ConvexError) {
    return (
      trimToNull(e.data) ??
      (e.data && typeof e.data === "object" && "message" in e.data
        ? trimToNull((e.data as { message: unknown }).message)
        : null) ??
      trimToNull(e.message) ??
      fallback
    );
  }

  if (e && typeof e === "object" && "data" in e) {
    const data = (e as { data: unknown }).data;
    const fromData =
      trimToNull(data) ??
      (data && typeof data === "object" && "message" in data
        ? trimToNull((data as { message: unknown }).message)
        : null);
    if (fromData) return fromData;
  }

  if (e instanceof Error) {
    const match = e.message.match(
      /(?:Uncaught (?:Convex)?Error|ConvexError):\s*(.+?)(?:\s+at handler|\s+at\s|\s+Called by client|$)/,
    );
    return trimToNull(match?.[1]) ?? trimToNull(e.message) ?? fallback;
  }

  return trimToNull(e) ?? fallback;
}
