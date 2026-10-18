import { describe, expect, it } from "vitest";
import { classifyTriggeredTransfers } from "./transfer-finality";

describe("external GEN transfer finality", () => {
  it("requires a successful finalized child receipt", () => {
    expect(
      classifyTriggeredTransfers(
        ["0xchild"],
        [{ txExecutionResultName: "FINISHED_WITH_RETURN" }],
      ),
    ).toEqual({ status: "confirmed", childIds: ["0xchild"] });
    expect(
      classifyTriggeredTransfers(
        ["0xchild"],
        [{ txExecutionResultName: "FINISHED_WITH_ERROR" }],
      ),
    ).toMatchObject({ status: "unconfirmed", childIds: ["0xchild"] });
  });

  it("does not treat a missing child identifier as delivery", () => {
    expect(classifyTriggeredTransfers([], [])).toMatchObject({
      status: "unconfirmed",
    });
  });
});
