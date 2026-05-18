import type { Doc } from "../_generated/dataModel";

export type SerializedVerification = {
  status:
    | "PENDING"
    | "PASSED"
    | "INCONCLUSIVE"
    | "FAILED"
    | "ERROR"
    | "SKIPPED";
  confidence: number | null;
  reasoning: string | null;
  flags: string[];
};

export function serializeVerification(
  v: Doc<"proofVerifications"> | null | undefined,
): SerializedVerification | null {
  if (!v) return null;
  return {
    status: v.status,
    confidence: v.confidence ?? null,
    reasoning: userFacingReasoning({
      status: v.status,
      reasoning: v.reasoning,
      errorMessage: v.errorMessage,
    }),
    flags: v.flags ?? [],
  };
}

export function userFacingReasoning(input: {
  status: string;
  reasoning?: string | null;
  errorMessage?: string | null;
}): string | null {
  if (input.status !== "ERROR") return input.reasoning ?? null;
  const e = (input.errorMessage ?? "").toLowerCase();
  if (e.includes("unsupported image") || e.includes("mime type")) {
    return "this image format isn't supported by the verifier";
  }
  if (e.includes("bad json") || e.includes("no json")) {
    return "the verifier returned an unreadable response";
  }
  if (e.includes("image fetch")) {
    return "couldn't load the image to analyze";
  }
  if (e.includes("rate") || e.includes("quota") || e.includes("429")) {
    return "verifier rate limit hit, try again later";
  }
  if (e.includes("api_key") || e.includes("api key") || e.includes("auth")) {
    return "the verifier is misconfigured";
  }
  return "the verifier hit an unexpected error";
}
