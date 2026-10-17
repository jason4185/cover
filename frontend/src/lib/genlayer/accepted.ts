import type { TrackedStatus } from "@genlayer/transaction-kit";

export type AcceptedSyncResult<T> = {
  confirmed: boolean;
  value?: T;
  attempts: number;
};

export function isAcceptedTransaction(status: TrackedStatus): boolean {
  return (
    status.phase === "decided" &&
    status.statusName?.toUpperCase() === "ACCEPTED" &&
    status.successful === true
  );
}

export function isRejectedTransaction(status: TrackedStatus): boolean {
  return status.phase === "decided" && !isAcceptedTransaction(status);
}

/**
 * Re-reads accepted-state data until the caller's authoritative predicate is
 * true. A false result is intentional: acceptance is never treated as proof
 * that the expected record is already visible.
 */
export async function readUntilAcceptedState<T>(
  read: () => Promise<T>,
  isVisible: (value: T) => boolean,
  options: { attempts?: number; intervalMs?: number } = {},
): Promise<AcceptedSyncResult<T>> {
  const attempts = Math.max(1, Math.floor(options.attempts ?? 5));
  const intervalMs = Math.max(0, Math.floor(options.intervalMs ?? 350));
  let lastValue: T | undefined;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastValue = await read();
    if (isVisible(lastValue)) {
      return { confirmed: true, value: lastValue, attempts: attempt };
    }
    if (attempt < attempts && intervalMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return {
    confirmed: false,
    attempts,
    ...(lastValue === undefined ? {} : { value: lastValue }),
  };
}
