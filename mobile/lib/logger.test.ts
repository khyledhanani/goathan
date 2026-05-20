import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger";

describe("createLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("writes structured entries in dev", () => {
    vi.stubGlobal("__DEV__", true);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    createLogger("mobile.test").error("webview_failed", {
      error: new Error("load failed"),
    });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toBe("[error] mobile.test: webview_failed");
    expect(spy.mock.calls[0][1]).toMatchObject({
      level: "error",
      scope: "mobile.test",
      message: "webview_failed",
      context: {
        error: {
          name: "Error",
          message: "load failed",
        },
      },
    });
  });

  it("filters low-priority logs outside dev", () => {
    vi.stubGlobal("__DEV__", false);
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    createLogger("mobile.test").debug("hidden");

    expect(spy).not.toHaveBeenCalled();
  });
});
