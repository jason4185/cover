export type ChildTransferReceipt = {
  txExecutionResultName?: string;
};

export function classifyTriggeredTransfers(
  childIds: readonly string[],
  receipts: readonly ChildTransferReceipt[],
):
  | { status: "confirmed"; childIds: string[] }
  | { status: "unconfirmed"; message: string; childIds?: string[] } {
  if (childIds.length === 0)
    return {
      status: "unconfirmed",
      message:
        "No triggered transfer identifier was returned. Native GEN delivery remains unverified.",
    };
  if (
    receipts.length !== childIds.length ||
    !receipts.every(
      (receipt) => receipt.txExecutionResultName === "FINISHED_WITH_RETURN",
    )
  ) {
    return {
      status: "unconfirmed",
      childIds: [...childIds],
      message:
        "A child transfer was found, but its finalized execution did not confirm successful GEN delivery.",
    };
  }
  return { status: "confirmed", childIds: [...childIds] };
}
