import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../lib/logger";

describe("createLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("writes structured JSON logs on the server", () => {
    vi.stubEnv("NEXT_PUBLIC_LOG_LEVEL", "debug");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    createLogger("test.scope").warn("thing_happened", {
      requestId: "req_123",
    });

    expect(spy).toHaveBeenCalledOnce();
    const entry = JSON.parse(spy.mock.calls[0][0] as string) as {
      level: string;
      scope: string;
      message: string;
      context: { requestId: string };
    };

    expect(entry).toMatchObject({
      level: "warn",
      scope: "test.scope",
      message: "thing_happened",
      context: { requestId: "req_123" },
    });
  });

  it("filters below the configured level", () => {
    vi.stubEnv("NEXT_PUBLIC_LOG_LEVEL", "error");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    createLogger("test.scope").warn("hidden");

    expect(spy).not.toHaveBeenCalled();
  });
});
