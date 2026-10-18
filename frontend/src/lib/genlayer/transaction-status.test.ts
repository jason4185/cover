import { describe, expect, it } from "vitest";
import {
  classifyParentFinality,
  transactionFinalityLabel,
  transferStatusLabel,
} from "./transaction-status";

describe("persistent transaction status labels", () => {
  it("keeps accepted, failed, and unresolved parent states distinct", () => {
    expect(
      classifyParentFinality({ phase: "finalized", successful: true }),
    ).toBe("success");
    expect(
      classifyParentFinality({ phase: "finalized", successful: false }),
    ).toBe("failed");
    expect(classifyParentFinality({ phase: "processing" })).toBe("unresolved");
    expect(transactionFinalityLabel("pending")).toBe("Finalization pending");
    expect(transactionFinalityLabel("failed")).toBe("Finalization failed");
    expect(transactionFinalityLabel("unavailable")).toBe(
      "Finalization unverified",
    );
    expect(transactionFinalityLabel("finalized")).toBe("Parent finalized");
  });

  it("never labels child execution as proof that a recipient received GEN", () => {
    expect(
      transferStatusLabel({ status: "confirmed", childIds: ["0xchild"] }),
    ).toContain("recipient delivery remains unverified");
    expect(
      transferStatusLabel({
        status: "unconfirmed",
        message: "Delivery is unresolved.",
      }),
    ).toBe("GEN delivery unverified");
  });
});
