import { describe, expect, it } from "vitest";
import { parseGenAmount } from "./format";
import {
  validateAgentId,
  validateCompensation,
  validateIncidentTime,
  validatePolicyTerms,
  validatePolicyholderAddress,
} from "./validation";

describe("contract-aligned frontend validation", () => {
  it("enforces the 160-character agent limit and required exclusions", () => {
    expect(validateAgentId("a".repeat(160))).toBeUndefined();
    expect(validateAgentId("a".repeat(161))).toContain("160");
    expect(validatePolicyTerms("covered loss", "")).toContain("Exclusions");
    expect(
      validatePolicyTerms("covered loss", "excluded action"),
    ).toBeUndefined();
  });

  it("rejects unsupported controls and the zero address", () => {
    expect(validateAgentId("agent\u0000")).toContain("control character");
    expect(validatePolicyholderAddress(`0x${"0".repeat(40)}`)).toContain(
      "zero",
    );
    expect(validatePolicyholderAddress(`0x${"1".repeat(40)}`)).toBeUndefined();
  });

  it("keeps GEN values exact and bounded by u256", () => {
    expect(validateCompensation("1.000000000000000001")).toEqual({
      value: 1_000_000_000_000_000_001n,
    });
    expect(() => parseGenAmount("9".repeat(78))).toThrow();
    expect(validateCompensation("0")).toEqual({
      error: "Compensation must be greater than zero.",
    });
  });

  it("keeps incident times inside the policy and in the past", () => {
    expect(
      validateIncidentTime(
        "2026-01-03T00:00",
        1_767_300_000,
        1_767_500_000,
        1_767_500_001,
      ),
    ).toEqual({
      value: 1767394800n,
    });
    expect(
      validateIncidentTime(
        "2026-01-03T00:00",
        1_767_300_000,
        1_767_500_000,
        1_767_394_799,
      ),
    ).toHaveProperty("error");
  });
});
