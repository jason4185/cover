import {
  CheckCircle2,
  FileCheck2,
  FileWarning,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { sha256File } from "@/lib/genlayer/evidence";
import type { EvidenceVerificationState } from "@/hooks/use-evidence-verification";
import { Button } from "./UI";

export function EvidenceVerificationStatus({
  verification,
  onRetry,
}: {
  verification: EvidenceVerificationState;
  onRetry: () => void;
}) {
  if (verification.status === "idle") {
    return (
      <div
        className="evidence-verification evidence-verification-idle"
        role="status"
      >
        <FileCheck2 size={17} />
        <span>Paste a Netlify HTTPS JSON URL to check the evidence.</span>
      </div>
    );
  }
  if (verification.status === "invalid") {
    return (
      <div
        className="evidence-verification evidence-verification-error"
        role="alert"
      >
        <FileWarning size={17} />
        <span>{verification.error}</span>
      </div>
    );
  }
  if (verification.status === "checking") {
    return (
      <div
        className="evidence-verification evidence-verification-checking"
        role="status"
      >
        <LoaderCircle className="spin" size={17} />
        <span>
          Checking evidence… fetching raw bytes and generating SHA-256.
        </span>
      </div>
    );
  }
  if (verification.status === "error") {
    return (
      <div
        className="evidence-verification evidence-verification-error"
        role="alert"
      >
        <FileWarning size={17} />
        <div>
          <span>{verification.error}</span>
          <Button className="evidence-retry" variant="quiet" onClick={onRetry}>
            <RefreshCw size={14} /> Retry
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div
      className="evidence-verification evidence-verification-success"
      role="status"
    >
      <CheckCircle2 size={17} />
      <div>
        <strong>Evidence hash generated</strong>
        <p>
          The server checked the response size and JSON format, then hashed the
          exact raw response bytes.
        </p>
        <details className="evidence-hash-details">
          <summary>View generated SHA-256</summary>
          <code>{verification.result.hash}</code>
          <small>
            {verification.result.byteLength.toLocaleString()} raw bytes ·
            read-only
          </small>
        </details>
      </div>
    </div>
  );
}

export function EvidenceTroubleshooting() {
  const [hash, setHash] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <details className="evidence-troubleshooting">
      <summary>Optional troubleshooting: hash a local JSON file</summary>
      <p>
        This does not upload the file or change the hash used for submission.
      </p>
      <input
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setError(undefined);
          void sha256File(file)
            .then(setHash)
            .catch(() => setError("The browser could not hash that file."))
            .finally(() => setBusy(false));
        }}
      />
      {busy && <small>Hashing local bytes…</small>}
      {hash && <code>{hash}</code>}
      {error && <small className="field-error">{error}</small>}
    </details>
  );
}
