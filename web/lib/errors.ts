import { ConvexError } from "convex/values";

export function errorMessage(e: unknown, fallback = "Something went wrong"): string {
  if (e instanceof ConvexError) {
    return typeof e.data === "string" ? e.data : fallback;
  }
  if (e instanceof Error) {
    const match = e.message.match(
      /Uncaught (?:Convex)?Error:\s*(.+?)(?:\s+at handler|\s+at\s|\s+Called by client|$)/,
    );
    if (match?.[1]) return match[1].trim();
    return e.message;
  }
  return fallback;
}
