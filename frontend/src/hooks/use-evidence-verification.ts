import { useEffect, useState } from "react";
import {
  validateNetlifyUrl,
  verifyEvidenceUrl,
  type EvidenceVerification,
} from "@/lib/genlayer/evidence";

export type EvidenceVerificationState =
  | { status: "idle"; url: string }
  | { status: "invalid"; url: string; error: string }
  | { status: "checking"; url: string }
  | { status: "verified"; url: string; result: EvidenceVerification }
  | { status: "error"; url: string; error: string };

export function useEvidenceVerification(url: string) {
  const normalizedUrl = url.trim();
  const [retryToken, setRetryToken] = useState(0);
  const [state, setState] = useState<EvidenceVerificationState>({
    status: "idle",
    url: "",
  });

  useEffect(() => {
    if (!normalizedUrl) {
      setState({ status: "idle", url: "" });
      return;
    }

    const validationError = validateNetlifyUrl(normalizedUrl);
    if (validationError) {
      setState({
        status: "invalid",
        url: normalizedUrl,
        error: validationError,
      });
      return;
    }

    const controller = new AbortController();
    let active = true;
    setState({ status: "checking", url: normalizedUrl });
    void verifyEvidenceUrl(normalizedUrl, controller.signal)
      .then((result) => {
        if (active)
          setState({ status: "verified", url: normalizedUrl, result });
      })
      .catch((cause: unknown) => {
        if (!active || controller.signal.aborted) return;
        setState({
          status: "error",
          url: normalizedUrl,
          error:
            cause instanceof Error
              ? cause.message
              : "The evidence file could not be checked.",
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [normalizedUrl, retryToken]);

  return {
    state:
      state.url === normalizedUrl
        ? state
        : ({ status: "idle", url: normalizedUrl } as const),
    retry: () => setRetryToken((current) => current + 1),
  };
}
