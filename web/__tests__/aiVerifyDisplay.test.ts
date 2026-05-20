import { describe, expect, it } from "vitest";
import {
  serializeVerification,
  userFacingReasoning,
} from "../convex/lib/aiVerifyDisplay";

describe("userFacingReasoning", () => {
  it("passes through non-error reasoning", () => {
    expect(
      userFacingReasoning({
        status: "PASSED",
        reasoning: "receipt matched the task",
      }),
    ).toBe("receipt matched the task");
  });

  it("maps known verifier errors to user-safe messages", () => {
    expect(
      userFacingReasoning({
        status: "ERROR",
        errorMessage: "429 quota exceeded",
      }),
    ).toBe("verifier rate limit hit, try again later");
  });
});

describe("serializeVerification", () => {
  it("normalizes optional fields for the UI", () => {
    expect(
      serializeVerification({
        status: "PENDING",
      } as Parameters<typeof serializeVerification>[0]),
    ).toEqual({
      status: "PENDING",
      confidence: null,
      reasoning: null,
      flags: [],
    });
  });
});
