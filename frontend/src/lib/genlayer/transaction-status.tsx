/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { TrackedStatus } from "@genlayer/transaction-kit";
import type { TransactionHash } from "genlayer-js/types";
import { userFacingError } from "./errors";
import { formatAddress } from "./format";
import {
  classifyTriggeredTransfers,
  type ChildTransferReceipt,
} from "./transfer-finality";
import { useWallet } from "./wallet";

const SESSION_KEY = "cover.transaction-monitor.v1";
const MAX_MONITORS = 8;

export type TransferMonitorState =
  | { status: "not-applicable" }
  | { status: "pending" }
  | { status: "unavailable"; message: string; childIds?: string[] }
  | { status: "confirmed"; childIds: string[] }
  | { status: "unconfirmed"; message: string; childIds?: string[] };

export type TransactionMonitor = {
  parentId: `0x${string}`;
  method: string;
  accepted: TrackedStatus;
  finalization: "pending" | "finalized" | "failed" | "unavailable";
  finalizationStatus?: TrackedStatus;
  finalizationMessage?: string;
  transfer: TransferMonitorState;
  updatedAt: number;
};

export type ParentFinality = "success" | "failed" | "unresolved";

type StoredMonitor = {
  parentId: `0x${string}`;
  method: string;
};

type TransactionStatusContextValue = {
  monitors: TransactionMonitor[];
  trackAccepted: (status: TrackedStatus, method: string) => void;
  refreshMonitor: (parentId: `0x${string}`) => void;
  dismissMonitor: (parentId: `0x${string}`) => void;
};

const TransactionStatusContext = createContext<
  TransactionStatusContextValue | undefined
>(undefined);

function isTransferOperation(method: string): boolean {
  return method === "settle_claim" || method === "refund_policy";
}

function isTransactionHash(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value);
}

function readStoredMonitors(): StoredMonitor[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(
      window.sessionStorage.getItem(SESSION_KEY) ?? "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): StoredMonitor[] => {
      if (
        typeof item !== "object" ||
        item === null ||
        !isTransactionHash((item as { parentId?: unknown }).parentId) ||
        typeof (item as { method?: unknown }).method !== "string"
      ) {
        return [];
      }
      return [
        {
          parentId: (item as { parentId: `0x${string}` }).parentId,
          method: (item as { method: string }).method,
        },
      ];
    });
  } catch {
    return [];
  }
}

function persistMonitors(monitors: TransactionMonitor[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify(
        monitors.slice(0, MAX_MONITORS).map(({ parentId, method }) => ({
          parentId,
          method,
        })),
      ),
    );
  } catch {
    // Session storage is only a convenience for status continuity. On-chain
    // reads remain authoritative when it is unavailable.
  }
}

function operationLabel(method: string): string {
  return method.replaceAll("_", " ");
}

export function transactionFinalityLabel(
  finalization: TransactionMonitor["finalization"],
): string {
  if (finalization === "pending") return "Finalization pending";
  if (finalization === "failed") return "Finalization failed";
  if (finalization === "unavailable") return "Finalization unverified";
  return "Parent finalized";
}

export function classifyParentFinality(
  status: Pick<TrackedStatus, "phase" | "successful">,
): ParentFinality {
  if (status.phase !== "finalized") return "unresolved";
  return status.successful === true ? "success" : "failed";
}

export function transferStatusLabel(
  transfer: TransferMonitorState,
): string | undefined {
  if (transfer.status === "not-applicable") return undefined;
  if (transfer.status === "pending") return "Child transfer pending";
  if (transfer.status === "confirmed") {
    return "Child execution finalized; recipient delivery remains unverified";
  }
  if (transfer.status === "unconfirmed") return "GEN delivery unverified";
  return "Child transfer status unavailable";
}

export function TransactionStatusProvider({
  children,
}: {
  children: ReactNode;
}) {
  const wallet = useWallet();
  const [monitors, setMonitors] = useState<TransactionMonitor[]>([]);
  const monitorsRef = useRef<TransactionMonitor[]>([]);
  const activeRef = useRef(new Set<string>());
  const hydratedRef = useRef(false);

  const updateMonitor = useCallback(
    (parentId: `0x${string}`, update: Partial<TransactionMonitor>): void => {
      setMonitors((current) => {
        const next = current
          .map((monitor) =>
            monitor.parentId === parentId
              ? { ...monitor, ...update, updatedAt: Date.now() }
              : monitor,
          )
          .sort((left, right) => right.updatedAt - left.updatedAt)
          .slice(0, MAX_MONITORS);
        monitorsRef.current = next;
        persistMonitors(next);
        return next;
      });
    },
    [],
  );

  const startTracker = useCallback(
    (parentId: `0x${string}`, method: string): void => {
      if (!wallet.kit || activeRef.current.has(parentId)) return;
      activeRef.current.add(parentId);
      updateMonitor(parentId, {
        finalization: "pending",
        finalizationMessage:
          "Reading the parent transaction until finalization.",
        ...(isTransferOperation(method)
          ? { transfer: { status: "pending" as const } }
          : {}),
      });

      void (async () => {
        try {
          const finalStatus = await wallet.kit!.track(
            parentId,
            (nextStatus) =>
              updateMonitor(parentId, { finalizationStatus: nextStatus }),
            { until: "finalized" },
          );
          updateMonitor(parentId, { finalizationStatus: finalStatus });
          const parentFinality = classifyParentFinality(finalStatus);
          if (parentFinality === "unresolved") {
            updateMonitor(parentId, {
              finalization: "unavailable",
              finalizationMessage:
                "The SDK returned without a finalized parent result.",
            });
            return;
          }
          if (parentFinality === "failed") {
            updateMonitor(parentId, {
              finalization: "failed",
              finalizationMessage: `Finalized execution failed: ${finalStatus.executionResultName ?? finalStatus.statusName ?? "unknown result"}.`,
              ...(isTransferOperation(method)
                ? {
                    transfer: {
                      status: "unavailable" as const,
                      message:
                        "The parent failed, so no GEN delivery is treated as confirmed.",
                    },
                  }
                : {}),
            });
            return;
          }

          updateMonitor(parentId, {
            finalization: "finalized",
            finalizationMessage:
              "The parent transaction finalized successfully. This does not independently prove GEN delivery.",
          });
          if (!isTransferOperation(method)) return;
          if (!wallet.connectedClient) {
            updateMonitor(parentId, {
              transfer: {
                status: "unavailable",
                message:
                  "The parent finalized, but a connected GenLayer client was unavailable to inspect child transfers.",
              },
            });
            return;
          }

          let childIds: string[];
          try {
            childIds = await wallet.connectedClient.getTriggeredTransactionIds({
              hash: parentId as TransactionHash,
            });
          } catch (cause) {
            updateMonitor(parentId, {
              transfer: {
                status: "unavailable",
                message: `The parent finalized, but child transfer identifiers could not be read: ${userFacingError(cause, "read")}`,
              },
            });
            return;
          }
          if (childIds.length === 0) {
            updateMonitor(parentId, {
              transfer: {
                status: "unconfirmed",
                message:
                  "No triggered transfer identifier was returned. Native GEN delivery remains unverified.",
              },
            });
            return;
          }

          try {
            const receipts: ChildTransferReceipt[] = await Promise.all(
              childIds.map((childId) =>
                wallet.connectedClient!.waitForFinalization({
                  hash: childId as TransactionHash,
                }),
              ),
            );
            updateMonitor(parentId, {
              transfer: classifyTriggeredTransfers(childIds, receipts),
            });
          } catch (cause) {
            updateMonitor(parentId, {
              transfer: {
                status: "unavailable",
                childIds,
                message: `Child transfer finalization could not be verified: ${userFacingError(cause, "read")}`,
              },
            });
          }
        } catch (cause) {
          updateMonitor(parentId, {
            finalization: "unavailable",
            finalizationMessage: `Finalization could not be confirmed: ${userFacingError(cause, "read")}`,
            ...(isTransferOperation(method)
              ? {
                  transfer: {
                    status: "unavailable" as const,
                    message:
                      "Parent finalization is unresolved, so native GEN delivery is not confirmed.",
                  },
                }
              : {}),
          });
        } finally {
          activeRef.current.delete(parentId);
        }
      })();
    },
    [updateMonitor, wallet.connectedClient, wallet.kit],
  );

  const trackAccepted = useCallback(
    (status: TrackedStatus, method: string): void => {
      const parentId = status.genlayerTxId;
      if (!parentId) return;
      const existing = monitorsRef.current.some(
        (monitor) => monitor.parentId === parentId,
      );
      if (!existing) {
        const nextMonitor: TransactionMonitor = {
          parentId,
          method,
          accepted: status,
          finalization: wallet.kit ? "pending" : "unavailable",
          ...(wallet.kit
            ? {}
            : {
                finalizationMessage:
                  "Finalization tracking is unavailable until the wallet reconnects. The contract read remains authoritative.",
              }),
          transfer: isTransferOperation(method)
            ? { status: "pending" }
            : { status: "not-applicable" },
          updatedAt: Date.now(),
        };
        const next = [nextMonitor, ...monitorsRef.current].slice(
          0,
          MAX_MONITORS,
        );
        monitorsRef.current = next;
        setMonitors(next);
        persistMonitors(next);
      }
      startTracker(parentId, method);
    },
    [startTracker, wallet.kit],
  );

  const refreshMonitor = useCallback(
    (parentId: `0x${string}`): void => {
      const monitor = monitorsRef.current.find(
        (item) => item.parentId === parentId,
      );
      if (monitor) startTracker(parentId, monitor.method);
    },
    [startTracker],
  );

  const dismissMonitor = useCallback((parentId: `0x${string}`): void => {
    const next = monitorsRef.current.filter(
      (monitor) => monitor.parentId !== parentId,
    );
    monitorsRef.current = next;
    setMonitors(next);
    persistMonitors(next);
  }, []);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const stored = readStoredMonitors();
    if (stored.length === 0) return;
    const restored: TransactionMonitor[] = stored.map(
      ({ parentId, method }) => ({
        parentId,
        method,
        accepted: {
          phase: "decided",
          statusName: "ACCEPTED",
          successful: true,
          genlayerTxId: parentId,
        },
        finalization: wallet.kit ? "pending" : "unavailable",
        ...(wallet.kit
          ? {}
          : {
              finalizationMessage:
                "Reconnect the wallet to resume finalization tracking. No delivery is assumed.",
            }),
        transfer: isTransferOperation(method)
          ? { status: "pending" }
          : { status: "not-applicable" },
        updatedAt: Date.now(),
      }),
    );
    monitorsRef.current = restored;
    setMonitors(restored);
    for (const monitor of restored)
      startTracker(monitor.parentId, monitor.method);
  }, [startTracker, wallet.kit]);

  useEffect(() => {
    if (!wallet.kit || !hydratedRef.current) return;
    for (const monitor of monitorsRef.current) {
      if (monitor.finalization === "unavailable") {
        startTracker(monitor.parentId, monitor.method);
      }
    }
  }, [startTracker, wallet.kit]);

  const value = useMemo<TransactionStatusContextValue>(
    () => ({ monitors, trackAccepted, refreshMonitor, dismissMonitor }),
    [dismissMonitor, monitors, refreshMonitor, trackAccepted],
  );

  return (
    <TransactionStatusContext.Provider value={value}>
      {children}
      <TransactionStatusTray />
    </TransactionStatusContext.Provider>
  );
}

export function useTransactionStatus() {
  const value = useContext(TransactionStatusContext);
  if (!value) {
    throw new Error(
      "useTransactionStatus must be used inside TransactionStatusProvider",
    );
  }
  return value;
}

function TransactionStatusTray() {
  const { monitors, refreshMonitor, dismissMonitor } = useTransactionStatus();
  if (monitors.length === 0) return null;
  return (
    <aside className="transaction-status-tray" aria-live="polite">
      <div className="transaction-status-tray-head">
        <div>
          <span className="eyebrow">Transaction monitor</span>
          <strong>Accepted activity</strong>
        </div>
        <span className="status-dot" aria-hidden="true" />
      </div>
      <div className="transaction-status-list">
        {monitors.slice(0, 4).map((monitor) => {
          const transferLabel = transferStatusLabel(monitor.transfer);
          return (
            <article className="transaction-status-item" key={monitor.parentId}>
              <div className="transaction-status-item-head">
                <strong>{operationLabel(monitor.method)}</strong>
                <button
                  className="transaction-status-dismiss"
                  type="button"
                  onClick={() => dismissMonitor(monitor.parentId)}
                  aria-label={`Hide ${operationLabel(monitor.method)} status`}
                >
                  ×
                </button>
              </div>
              <code title={monitor.parentId}>
                {formatAddress(monitor.parentId)}
              </code>
              <details className="transaction-status-id">
                <summary>Full parent transaction ID</summary>
                <code>{monitor.parentId}</code>
              </details>
              <span>{transactionFinalityLabel(monitor.finalization)}</span>
              {transferLabel && <span>{transferLabel}</span>}
              {monitor.finalizationMessage && (
                <p>{monitor.finalizationMessage}</p>
              )}
              {(monitor.transfer.status === "unavailable" ||
                monitor.transfer.status === "unconfirmed") && (
                <p>{monitor.transfer.message}</p>
              )}
              {monitor.transfer.status !== "confirmed" && (
                <button
                  className="transaction-status-refresh"
                  type="button"
                  onClick={() => refreshMonitor(monitor.parentId)}
                >
                  Refresh status
                </button>
              )}
              {monitor.transfer.status !== "not-applicable" &&
                "childIds" in monitor.transfer &&
                monitor.transfer.childIds && (
                  <p className="tiny-note">
                    Child transaction: {monitor.transfer.childIds.join(", ")}
                  </p>
                )}
            </article>
          );
        })}
      </div>
    </aside>
  );
}
