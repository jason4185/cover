import {
  GenLayerTransactionPanel,
  type TrackedStatus,
} from "@genlayer/transaction-kit-react";
import type { SubmitInput } from "@genlayer/transaction-kit";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useWallet } from "@/lib/genlayer/wallet";
import { userFacingError } from "@/lib/genlayer/errors";
import { isAcceptedTransaction } from "@/lib/genlayer/accepted";
import { formatAddress, formatGen } from "@/lib/genlayer/format";
import { Button } from "./UI";

export type AcceptedSyncResult = {
  confirmed: boolean;
  message: string;
  continueHref?: string;
  next?: { to: "policy" | "policies"; id?: string };
};

function defaultAcceptedResult(tx: SubmitInput): AcceptedSyncResult {
  const method = tx.kind === "write" ? tx.method : "";
  const transfer = method === "settle_claim" || method === "refund_policy";
  return {
    confirmed: true,
    message: transfer
      ? "Accepted and visible in contract state. Native GEN transfer confirmation remains unavailable until independently verified."
      : "Accepted by consensus and visible in the accepted-state contract read.",
  };
}

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function TransactionModal({
  open,
  title,
  description,
  tx,
  userValue,
  review,
  onAccepted,
  onSuccess,
  onFinalized,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  tx: SubmitInput;
  userValue?: bigint | undefined;
  review?: ReactNode;
  onAccepted?: (status: TrackedStatus) => Promise<AcceptedSyncResult>;
  onSuccess?: (status: TrackedStatus, result: AcceptedSyncResult) => void;
  onFinalized?: (status: TrackedStatus) => void;
  onClose: () => void;
}) {
  const wallet = useWallet();
  const modalRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const canCloseRef = useRef(true);
  const [status, setStatus] = useState<TrackedStatus>();
  const [error, setError] = useState<string>();
  const [syncing, setSyncing] = useState(false);
  const [acceptedResult, setAcceptedResult] = useState<AcceptedSyncResult>();
  const [finalization, setFinalization] = useState<TrackedStatus>();
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      mountedRef.current = false;
      setStatus(undefined);
      setError(undefined);
      setSyncing(false);
      setAcceptedResult(undefined);
      setFinalization(undefined);
      return;
    }

    mountedRef.current = true;
    const previousOverflow = document.body.style.overflow;
    const previousActiveElement = document.activeElement;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      if (closeRef.current && !closeRef.current.disabled) {
        closeRef.current.focus();
      } else {
        modalRef.current?.focus();
      }
    }, 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (canCloseRef.current) {
          event.preventDefault();
          onClose();
        }
        return;
      }
      if (event.key !== "Tab" || !modalRef.current) return;
      const elements = focusableElements(modalRef.current);
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousActiveElement instanceof HTMLElement)
        previousActiveElement.focus();
    };
  }, [onClose, open]);

  const canClose =
    !syncing &&
    (!status ||
      status.phase === "finalized" ||
      Boolean(error) ||
      Boolean(acceptedResult));
  canCloseRef.current = canClose;

  if (!open || typeof document === "undefined") return null;

  const close = () => {
    if (canClose) onClose();
  };

  const handleDone = async (nextStatus: TrackedStatus) => {
    setStatus(nextStatus);
    if (isAcceptedTransaction(nextStatus)) {
      if (nextStatus.genlayerTxId && wallet.kit) {
        void wallet.kit
          .track(nextStatus.genlayerTxId, () => undefined, {
            until: "finalized",
          })
          .then((finalStatus) => {
            if (finalStatus.phase !== "finalized") return;
            if (mountedRef.current) setFinalization(finalStatus);
            onFinalized?.(finalStatus);
          })
          .catch(() => undefined);
      }
      setSyncing(true);
      try {
        const result =
          (await onAccepted?.(nextStatus)) ?? defaultAcceptedResult(tx);
        setAcceptedResult(result);
        if (result.confirmed) onSuccess?.(nextStatus, result);
      } catch (cause) {
        setAcceptedResult({
          confirmed: false,
          message: `The transaction was accepted, but the expected contract state could not be confirmed. ${userFacingError(cause, "read")}`,
          ...(tx.kind === "write" && tx.method === "create_policy"
            ? { continueHref: "/policies" }
            : {}),
        });
      } finally {
        setSyncing(false);
      }
      return;
    }

    if (nextStatus.phase === "decided") {
      const detail =
        nextStatus.statusName === "ACCEPTED"
          ? "The transaction was accepted by consensus, but contract execution failed."
          : `The transaction reached ${nextStatus.statusName ?? "an unresolved decision"} and did not produce a usable state change.`;
      setError(detail);
      return;
    }

    if (nextStatus.phase === "finalized" && nextStatus.successful !== true) {
      setError(
        `Finalized execution failed: ${nextStatus.executionResultName ?? nextStatus.statusName ?? "unknown result"}.`,
      );
    }
  };

  const body = (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        ref={modalRef}
        className="transaction-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-title"
        aria-describedby="transaction-description"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <p className="eyebrow">Studio Next transaction</p>
            <h2 id="transaction-title">{title}</h2>
          </div>
          <button
            ref={closeRef}
            className="icon-button"
            type="button"
            onClick={close}
            disabled={!canClose}
            aria-label={
              canClose ? "Close transaction review" : "Transaction in progress"
            }
          >
            <X size={18} />
          </button>
        </header>
        <div className="transaction-modal-scroll">
          <p id="transaction-description" className="modal-copy">
            {description}
          </p>
          <div className="transaction-context">
            <div>
              <span>Contract</span>
              <code title={tx.kind === "write" ? tx.address : undefined}>
                {tx.kind === "write" ? formatAddress(tx.address) : "COVER"}
              </code>
            </div>
            <div>
              <span>Operation</span>
              <strong>
                {tx.kind === "write" ? tx.method : "Deploy contract"}
              </strong>
            </div>
            <div>
              <span>Signing wallet</span>
              <code title={wallet.address}>
                {wallet.address
                  ? formatAddress(wallet.address)
                  : "Not connected"}
              </code>
            </div>
            {userValue !== undefined && (
              <div>
                <span>GEN sent with call</span>
                <strong>{formatGen(userValue)}</strong>
              </div>
            )}
          </div>
          {review && <div className="transaction-review">{review}</div>}
          {acceptedResult && (
            <div
              className={`transaction-accepted ${acceptedResult.confirmed ? "is-confirmed" : "is-syncing"}`}
            >
              <div>
                <strong>
                  {acceptedResult.confirmed
                    ? "Accepted"
                    : "Accepted — synchronization pending"}
                </strong>
                <p>{acceptedResult.message}</p>
              </div>
              {acceptedResult.continueHref && (
                <a
                  className="button button-outline"
                  href={acceptedResult.continueHref}
                >
                  Continue to policies
                </a>
              )}
            </div>
          )}
          {error && (
            <div className="error-state">
              <span>!</span>
              <div>
                <strong>Execution not confirmed</strong>
                <p>{userFacingError(error, "write")}</p>
                <p className="tiny-note">
                  An accepted transaction is not proof of successful execution.
                  Check the transaction details before retrying.
                </p>
              </div>
            </div>
          )}
          {!error && !acceptedResult && !wallet.address && (
            <div className="transaction-gate">
              <p>
                Connect an injected wallet to review fees and sign this action.
              </p>
              <Button variant="light" onClick={() => void wallet.connect()}>
                Connect wallet
              </Button>
            </div>
          )}
          {!error &&
            !acceptedResult &&
            wallet.address &&
            wallet.status !== "connected" && (
              <div className="transaction-gate">
                <p>Switch your wallet to Studio Next before signing.</p>
                <Button
                  variant="light"
                  onClick={() => void wallet.switchToStudioNext()}
                >
                  Switch network
                </Button>
              </div>
            )}
          {!error &&
            wallet.address &&
            wallet.status === "connected" &&
            wallet.kit &&
            !acceptedResult && (
              <div className="transaction-kit-wrap">
                <GenLayerTransactionPanel
                  kit={wallet.kit}
                  tx={tx}
                  network="Studio Next"
                  theme="dark"
                  trackUntil="decided"
                  {...(userValue === undefined ? {} : { userValue })}
                  onDone={(nextStatus) => void handleDone(nextStatus)}
                />
              </div>
            )}
          {syncing && (
            <div className="transaction-sync" role="status">
              <span className="status-dot" />
              <span>
                Accepted. Refreshing the accepted-state contract read…
              </span>
            </div>
          )}
          {status?.genlayerTxId && (
            <div className="transaction-receipt">
              <span className="eyebrow">Transaction id</span>
              <code>{status.genlayerTxId}</code>
              {status.phase === "decided" &&
                status.statusName === "ACCEPTED" && (
                  <p className="tiny-note">
                    Finalization may continue separately. This application does
                    not treat finalization as proof that an external GEN
                    transfer was received.
                  </p>
                )}
              {finalization?.phase === "finalized" && (
                <p className="tiny-note">
                  Finalized status observed separately. This still does not
                  independently confirm an external GEN transfer.
                </p>
              )}
              {canClose && (
                <Button variant="quiet" onClick={close}>
                  Close
                </Button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
  return createPortal(body, document.body);
}
