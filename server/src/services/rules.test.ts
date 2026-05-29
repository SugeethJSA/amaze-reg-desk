import { describe, expect, it } from "vitest";
import { evaluateRule } from "./rules.js";

describe("scan rule evaluation", () => {
  it("denies scans when no active rule exists", () => {
    expect(evaluateRule(null, "entry")).toEqual({
      allowed: false,
      reason: "No active rule is available for this station."
    });
  });

  it("accepts matching station rules", () => {
    expect(evaluateRule({ station: "food" }, "food")).toEqual({ allowed: true, reason: "Accepted." });
  });
});
