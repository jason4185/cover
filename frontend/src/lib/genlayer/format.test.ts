import { describe, expect, it } from "vitest";
import { formatGen, isHexAddress, parseGenAmount, sameAddress } from "./format";

describe("GEN formatting", () => {
  it("round-trips exact base units without floating point", () => {
    const amount = parseGenAmount("12.000000000000000001");
    expect(amount).toBe(12000000000000000001n);
    expect(formatGen(amount)).toBe("12.000000000000000001 GEN");
  });

  it("rejects excess precision and malformed values", () => {
    expect(() => parseGenAmount("1.0000000000000000001")).toThrow();
    expect(() => parseGenAmount("-1")).toThrow();
  });
});

describe("address handling", () => {
  it("compares addresses case-insensitively and validates shape", () => {
    const lower = "0x1111111111111111111111111111111111111111";
    expect(sameAddress(lower, lower.toUpperCase())).toBe(true);
    expect(isHexAddress(lower)).toBe(true);
    expect(isHexAddress("0x1234")).toBe(false);
  });
});
