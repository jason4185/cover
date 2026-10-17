import { describe, expect, test } from "vitest";
import type { TrackedStatus } from "@genlayer/transaction-kit";
import {
  isAcceptedTransaction,
  isRejectedTransaction,
  readUntilAcceptedState,
} from "./accepted";

function status(overrides: Partial<TrackedStatus>): TrackedStatus {
  return { phase: "pending", ...overrides };
}

describe("accepted Studio Next transaction state", () => {
  test("accepts successful decided execution before finalization", () => {
    const accepted = status({
      phase: "decided",
      statusName: "ACCEPTED",
      executionResultName: "FINISHED_WITH_RETURN",
      successful: true,
    });

    expect(isAcceptedTransaction(accepted)).toBe(true);
    expect(isRejectedTransaction(accepted)).toBe(false);
  });

  test("does not treat failed or unresolved decisions as accepted", () => {
    expect(
      isAcceptedTransaction(
        status({
          phase: "decided",
          statusName: "ACCEPTED",
          executionResultName: "FINISHED_WITH_ERROR",
          successful: false,
        }),
      ),
    ).toBe(false);
    expect(
      isRejectedTransaction(
        status({ phase: "decided", statusName: "UNDETERMINED" }),
      ),
    ).toBe(true);
  });

  test("keeps synchronizing when accepted state visibility is delayed", async () => {
    const values = [{ visible: false }, { visible: false }, { visible: true }];
    const result = await readUntilAcceptedState(
      async () => values.shift() ?? { visible: true },
      (value) => value.visible,
      { attempts: 3, intervalMs: 0 },
    );

    expect(result.confirmed).toBe(true);
    expect(result.attempts).toBe(3);
  });

  test("returns an honest unconfirmed result after bounded reads", async () => {
    const result = await readUntilAcceptedState(
      async () => ({ visible: false }),
      (value) => value.visible,
      { attempts: 2, intervalMs: 0 },
    );

    expect(result.confirmed).toBe(false);
    expect(result.attempts).toBe(2);
  });
});
