import { describe, expect, it } from "vitest";
import { firstName, titleCase } from "../lib/utils";

describe("titleCase", () => {
  it("capitalizes significant words and leaves short words lower-case", () => {
    expect(titleCase("TEAM DINNER at THE PUB")).toBe("Team Dinner at The Pub");
  });
});

describe("firstName", () => {
  it("returns the first non-empty name segment", () => {
    expect(firstName("  Ada   Lovelace  ")).toBe("Ada");
  });
});
