export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error) ?? "Unknown error";
  } catch {
    return "Unknown error";
  }
}

export function userFacingError(
  error: unknown,
  context: "read" | "wallet" | "write" = "read",
) {
  const text = errorText(error);
  const lower = text.toLowerCase();
  if (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("4001")
  ) {
    return "The wallet signature was cancelled.";
  }
  if (lower.includes("insufficient") && lower.includes("gen")) {
    return "The wallet does not have enough GEN for this action.";
  }
  if (lower.includes("4901") || lower.includes("wrong network")) {
    return "Switch your wallet to GenLayer Studio Next.";
  }
  if (lower.includes("deadline") || lower.includes("window")) {
    return "This action is outside the contract's current deadline or response window.";
  }
  if (
    lower.includes("only ") ||
    lower.includes("unauthorized") ||
    lower.includes("policyholder") ||
    lower.includes("insurer")
  ) {
    return "This wallet is not authorized for that action.";
  }
  if (
    lower.includes("already") ||
    lower.includes("duplicate") ||
    lower.includes("not claimable")
  ) {
    return "This action has already been completed or the record is no longer eligible.";
  }
  if (lower.includes("not configured")) return text;
  if (context === "wallet") return `Wallet connection failed: ${text}`;
  if (context === "write")
    return `COVER could not complete this transaction: ${text}`;
  return `COVER records are unavailable right now: ${text}`;
}
