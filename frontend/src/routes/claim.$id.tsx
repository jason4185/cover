import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, FileUp, Gavel, Send, TimerReset } from "lucide-react";
import { PageContainer, PageIntro } from "@/components/cover/Shell";
import {
  EvidenceTroubleshooting,
  EvidenceVerificationStatus,
} from "@/components/cover/EvidenceVerification";
import { TransactionModal } from "@/components/cover/TransactionModal";
import {
  Button,
  ErrorState,
  EvidenceLink,
  InfoRow,
  LoadingState,
  Panel,
  StatusPill,
  Timeline,
  UnconfiguredState,
} from "@/components/cover/UI";
import {
  useClaim,
  useCoverConfig,
  useCoverRefresh,
  usePolicy,
} from "@/hooks/use-cover-data";
import { readClaim } from "@/lib/genlayer/reads";
import { readUntilAcceptedState } from "@/lib/genlayer/accepted";
import { COVER_CONFIGURED } from "@/lib/genlayer/config";
import {
  formatAddress,
  formatDateTime,
  formatGen,
  formatStatus,
  nowSeconds,
} from "@/lib/genlayer/format";
import { MAX_RESPONSE, validateText } from "@/lib/genlayer/validation";
import { validateNetlifyUrl } from "@/lib/genlayer/evidence";
import { useEvidenceVerification } from "@/hooks/use-evidence-verification";
import {
  canAdjudicateClaim,
  canCloseInsufficientClaim,
  canFinalizeInsurerResponse,
  canFinalizeReviewResponse,
  canReconsiderClaim,
  canSettleClaim,
  canSubmitReviewEvidence,
  canSubmitReviewResponse,
  canSubmitInsurerResponse,
  canWaiveReviewResponse,
  canWaiveInsurerResponse,
} from "@/lib/genlayer/permissions";
import { useWallet } from "@/lib/genlayer/wallet";
import {
  adjudicateClaimWrite,
  closeInsufficientClaimWrite,
  finalizeReviewResponseWrite,
  finalizeInsurerResponseWrite,
  reconsiderClaimWrite,
  settleClaimWrite,
  submitReviewEvidenceWrite,
  submitReviewResponseWrite,
  submitInsurerResponseWrite,
  waiveReviewResponseWrite,
  waiveInsurerResponseWrite,
} from "@/lib/genlayer/writes";
import type { CoverWrite } from "@/lib/genlayer/types";

export const Route = createFileRoute("/claim/$id")({
  component: ClaimDetailPage,
});
type TransactionState = {
  tx: CoverWrite;
  title: string;
  description: string;
  review?: ReactNode;
};

function ClaimDetailPage() {
  const { id } = Route.useParams();
  const query = useClaim(id);
  const claim = query.data;
  const policy = usePolicy(claim?.policyId ?? "0");
  const config = useCoverConfig();
  const wallet = useWallet();
  const refresh = useCoverRefresh();
  const [transaction, setTransaction] = useState<TransactionState>();
  const [success, setSuccess] = useState<string>();
  const now = nowSeconds();
  const supportsReconsideration = config.data?.supportsReconsideration === true;

  if (!COVER_CONFIGURED)
    return (
      <PageContainer>
        <PageIntro
          eyebrow="Claim record"
          title="A contract address is required."
          description="This page is ready for Studio Next, but no COVER deployment address has been supplied."
        />
        <UnconfiguredState />
      </PageContainer>
    );
  if (query.isLoading)
    return (
      <PageContainer>
        <LoadingState label="Reading claim" />
      </PageContainer>
    );
  if (query.error || !claim)
    return (
      <PageContainer>
        <ErrorState
          message={query.error?.message ?? "Claim not found."}
          retry={() => void query.refetch()}
        />
      </PageContainer>
    );
  if (policy.isLoading)
    return (
      <PageContainer>
        <LoadingState label="Reading related policy" />
      </PageContainer>
    );
  if (policy.error || !policy.data)
    return (
      <PageContainer>
        <ErrorState
          message={policy.error?.message ?? "Related policy not found."}
          retry={() => void policy.refetch()}
        />
      </PageContainer>
    );
  const relatedPolicy = policy.data;
  const responseDeadlineOpen = now < claim.responseDeadline;
  const canRespond = canSubmitInsurerResponse(
    claim,
    relatedPolicy,
    wallet.address,
    now,
  );
  const canFinalize = canFinalizeInsurerResponse(
    claim,
    relatedPolicy,
    wallet.address,
    now,
  );
  const canWaive = canWaiveInsurerResponse(
    claim,
    relatedPolicy,
    wallet.address,
    now,
  );
  const canAdjudicate = canAdjudicateClaim(
    claim,
    relatedPolicy,
    wallet.address,
    now,
  );
  const canClose = canCloseInsufficientClaim(
    claim,
    relatedPolicy,
    wallet.address,
    now,
  );
  const canReviewEvidence =
    supportsReconsideration &&
    canSubmitReviewEvidence(claim, relatedPolicy, wallet.address, now);
  const canReviewResponse =
    supportsReconsideration &&
    canSubmitReviewResponse(claim, relatedPolicy, wallet.address, now);
  const canFinalizeReview =
    supportsReconsideration &&
    canFinalizeReviewResponse(claim, relatedPolicy, wallet.address, now);
  const canWaiveReview =
    supportsReconsideration &&
    canWaiveReviewResponse(claim, relatedPolicy, wallet.address, now);
  const canReconsider =
    supportsReconsideration &&
    canReconsiderClaim(claim, relatedPolicy, wallet.address, now);
  const canSettle = canSettleClaim(claim, wallet.address);
  const afterSuccess = async (message: string) => {
    setTransaction(undefined);
    setSuccess(message);
    await refresh();
    await query.refetch();
    await policy.refetch();
  };
  const synchronizeAcceptedState = async () => {
    if (!transaction) {
      return {
        confirmed: false,
        message:
          "The transaction was accepted, but the claim action could not be identified for synchronization.",
      };
    }

    const method = transaction.tx.method;
    await refresh();
    const result = await readUntilAcceptedState(
      () => readClaim(claim.id),
      (currentClaim) => {
        if (method === "submit_insurer_response") {
          return currentClaim.responseSubmitted;
        }
        if (method === "finalize_insurer_response") {
          return (
            currentClaim.responseFinalized &&
            currentClaim.status === "READY_FOR_JUDGMENT"
          );
        }
        if (method === "waive_insurer_response") {
          return (
            currentClaim.responseWaived &&
            currentClaim.status === "READY_FOR_JUDGMENT"
          );
        }
        if (method === "adjudicate_claim") {
          return (
            currentClaim.verdict !== "" &&
            ["SETTLEMENT_PENDING", "REVIEW_OPEN", "JUDGED"].includes(
              currentClaim.status,
            )
          );
        }
        if (method === "close_insufficient_claim") {
          return currentClaim.status === "CLOSED";
        }
        if (method === "submit_review_evidence") {
          return currentClaim.reviewEvidenceSubmitted;
        }
        if (method === "submit_review_response") {
          return currentClaim.reviewResponseSubmitted;
        }
        if (method === "finalize_review_response") {
          return currentClaim.reviewResponseFinalized;
        }
        if (method === "waive_review_response") {
          return (
            currentClaim.reviewResponseWaived &&
            currentClaim.reviewResponseFinalized
          );
        }
        if (method === "reconsider_claim") {
          return (
            currentClaim.reviewAttempts > claim.reviewAttempts &&
            currentClaim.verdict !== ""
          );
        }
        if (method === "settle_claim") {
          return currentClaim.status === "PAID";
        }
        return false;
      },
    );
    await refresh();
    await query.refetch();
    await policy.refetch();
    const settlement = method === "settle_claim";
    return {
      confirmed: result.confirmed,
      message: result.confirmed
        ? settlement
          ? "Settlement accepted and the claim now shows the contract's PAID state. External GEN receipt confirmation remains unavailable; do not describe the payout as received yet."
          : `${transaction.title} accepted and the claim record has been refreshed.`
        : settlement
          ? "Settlement accepted, but the PAID state is not visible yet. Do not retry while the earlier transaction remains unresolved."
          : `${transaction.title} was accepted, but the updated claim state is not visible yet. Refresh before continuing.`,
    };
  };
  const review = (
    <div className="review-stack">
      <div className="review-item">
        <span>Claim</span>
        <strong>
          #{claim.id} · Policy #{claim.policyId}
        </strong>
      </div>
      <div className="review-item">
        <span>Wallet authority</span>
        <strong>
          {wallet.address ? formatAddress(wallet.address) : "Not connected"}
        </strong>
      </div>
      <div className="review-item">
        <span>Execution</span>
        <strong>
          Accepted updates are usable for the claim workflow; finalization
          remains separate
        </strong>
      </div>
    </div>
  );

  return (
    <PageContainer>
      <PageIntro
        eyebrow={`Claim / ${claim.id.padStart(4, "0")}`}
        title={formatStatus(claim.verdict || claim.status)}
        description="A claim record for a simulated incident. The contract controls the process; GenLayer supplies only the bounded judgment."
        action={<StatusPill status={claim.verdict || claim.status} />}
      />
      {success && (
        <div
          className="unconfigured"
          style={{
            marginTop: 24,
            borderColor: "rgba(189,221,176,.35)",
            color: "var(--positive)",
          }}
        >
          <CheckCircle2 size={17} />
          <span>{success}</span>
        </div>
      )}
      <div className="detail-layout">
        <div className="detail-main">
          <Panel>
            <div className="panel-head">
              <div>
                <h2>Claim record</h2>
                <p>
                  Policy{" "}
                  <Link
                    className="text-link"
                    to="/policy/$id"
                    params={{ id: claim.policyId }}
                  >
                    #{claim.policyId}
                  </Link>{" "}
                  · one claim maximum per policy.
                </p>
              </div>
              <Gavel size={19} color="var(--signal)" />
            </div>
            <div className="info-list">
              <InfoRow
                label="Policyholder / Claimant"
                value={
                  <span className="mono">
                    {formatAddress(relatedPolicy.policyholder)}
                  </span>
                }
              />
              <InfoRow
                label="Insured agent"
                value={relatedPolicy.insuredAgentId}
              />
              <InfoRow label="Filed" value={formatDateTime(claim.createdAt)} />
              <InfoRow
                label="Claimed incident time"
                value={formatDateTime(claim.incidentTime)}
              />
              <InfoRow
                label="Fixed compensation"
                value={formatGen(relatedPolicy.compensation)}
              />
              <InfoRow
                label="Reserve status"
                value={formatGen(relatedPolicy.reserveRemaining)}
              />
            </div>
            <div className="copy-block">
              <h3>Incident description</h3>
              <p>{claim.description}</p>
            </div>
          </Panel>
          {claim.status === "REVIEW_OPEN" && supportsReconsideration && (
            <Panel>
              <div className="panel-head">
                <div>
                  <h2>Reconsideration</h2>
                  <p>
                    One review attempt is available before the review deadline
                    and during the fixed 24-hour grace period when review
                    evidence is pending. Original evidence and the first
                    judgment remain unchanged.
                  </p>
                </div>
                <FileUp size={19} color="var(--signal)" />
              </div>
              <div className="info-list">
                <InfoRow
                  label="Review deadline"
                  value={formatDateTime(claim.reviewDeadline)}
                />
                <InfoRow
                  label="Attempts"
                  value={`${claim.reviewAttempts} of 1 used`}
                />
                <InfoRow
                  label="First judgment"
                  value={claim.initialVerdict || "Insufficient evidence"}
                />
                <InfoRow
                  label="First reason"
                  value={formatStatus(
                    claim.initialReasonCode || "INSUFFICIENT_EVIDENCE",
                  )}
                />
              </div>
              {canReviewEvidence && (
                <ReviewEvidenceForm
                  claimId={claim.id}
                  onSubmit={(tx) =>
                    setTransaction({
                      tx,
                      title: "Submit review evidence",
                      description:
                        "This stores one additional Netlify evidence commitment without changing the original claim evidence. The hash covers the exact fetched response bytes.",
                      review,
                    })
                  }
                />
              )}
              {claim.reviewEvidenceSubmitted && (
                <EvidenceLink
                  label="Review evidence"
                  url={claim.reviewEvidenceUrl}
                  hash={claim.reviewEvidenceSha256}
                />
              )}
              {canReviewResponse && (
                <ReviewResponseForm
                  claimId={claim.id}
                  onSubmit={(tx) =>
                    setTransaction({
                      tx,
                      title: "Submit review response",
                      description:
                        "This stores the Insurer's one review response and counterevidence without changing the original response.",
                      review,
                    })
                  }
                />
              )}
              {claim.reviewResponseSubmitted && (
                <>
                  <div className="copy-block">
                    <h3>Review response</h3>
                    <p>{claim.reviewResponse}</p>
                  </div>
                  {claim.reviewResponseUrl && (
                    <EvidenceLink
                      label="Review counterevidence"
                      url={claim.reviewResponseUrl}
                      hash={claim.reviewResponseSha256}
                    />
                  )}
                </>
              )}
              {(canFinalizeReview || canWaiveReview) && (
                <div className="inline-actions" style={{ marginTop: 18 }}>
                  {canFinalizeReview && (
                    <Button
                      variant="light"
                      onClick={() =>
                        setTransaction({
                          tx: finalizeReviewResponseWrite(claim.id),
                          title: "Finalize review response",
                          description:
                            "The review response opportunity is complete. A participant may request the single reconsideration judgment.",
                          review,
                        })
                      }
                    >
                      Finalize review response
                    </Button>
                  )}
                  {canWaiveReview && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        setTransaction({
                          tx: waiveReviewResponseWrite(claim.id),
                          title: "Waive review response",
                          description:
                            "Waiving ends the Insurer's review response opportunity without changing the first judgment.",
                          review,
                        })
                      }
                    >
                      Waive review response
                    </Button>
                  )}
                </div>
              )}
              {canReconsider && (
                <Button
                  variant="light"
                  onClick={() =>
                    setTransaction({
                      tx: reconsiderClaimWrite(claim.id),
                      title: "Request reconsideration",
                      description:
                        "GenLayer will independently fetch the replacement evidence, reapply the insured-agent identity gate, and evaluate the claim once more.",
                      review,
                    })
                  }
                >
                  Request reconsideration
                </Button>
              )}
            </Panel>
          )}
          {claim.status === "REVIEW_OPEN" && !supportsReconsideration && (
            <Panel>
              <div className="empty-state">
                <p>
                  This deployed contract does not advertise the bounded review
                  process. The claim remains governed by its existing review
                  deadline.
                </p>
              </div>
            </Panel>
          )}
          <Panel>
            <div className="panel-head">
              <div>
                <h2>Evidence commitments</h2>
                <p>
                  Netlify-hosted JSON is untrusted input. A matching hash
                  confirms byte integrity, not incident authenticity.
                </p>
              </div>
            </div>
            <EvidenceLink
              label="Policyholder evidence"
              url={claim.evidenceUrl}
              hash={claim.evidenceSha256}
            />
            {claim.responseUrl ? (
              <EvidenceLink
                label="Insurer counterevidence"
                url={claim.responseUrl}
                hash={claim.responseSha256}
              />
            ) : (
              <div className="evidence-empty">
                No Insurer counterevidence has been committed.
              </div>
            )}
          </Panel>
          <Panel>
            <div className="panel-head">
              <div>
                <h2>Insurer response</h2>
                <p>
                  {claim.responseSubmitted
                    ? "The Insurer submitted a response."
                    : "The Insurer has not submitted a response."}
                </p>
              </div>
              {claim.responseWaived ? (
                <StatusPill status="RESPONSE_WAIVED" />
              ) : claim.responseFinalized ? (
                <StatusPill status="READY_FOR_JUDGMENT" />
              ) : (
                <TimerReset size={18} color="var(--warning)" />
              )}
            </div>
            {claim.response && (
              <div className="copy-block">
                <h3>Response text</h3>
                <p>{claim.response}</p>
              </div>
            )}
            <div className="info-list">
              <InfoRow
                label="Submitted"
                value={claim.responseSubmitted ? "Yes" : "No"}
              />
              <InfoRow
                label="Finalized"
                value={claim.responseFinalized ? "Yes" : "No"}
              />
              <InfoRow
                label="Response deadline"
                value={formatDateTime(claim.responseDeadline)}
              />
            </div>
          </Panel>
          {canRespond && (
            <ResponseForm
              claimId={claim.id}
              onSubmit={(tx) =>
                setTransaction({
                  tx,
                  title: "Review insurer response",
                  description:
                    "This stores the Insurer's response and counterevidence commitment. It does not decide coverage.",
                  review,
                })
              }
            />
          )}
          {(canFinalize || canWaive) && (
            <Panel className="action-panel">
              <h3>Close the response opportunity</h3>
              <p>
                Finalization or waiver makes the claim immediately eligible for
                a judgment. Neither action approves or rejects the claim.
              </p>
              {canFinalize && (
                <Button
                  variant="light"
                  onClick={() =>
                    setTransaction({
                      tx: finalizeInsurerResponseWrite(claim.id),
                      title: "Finalize insurer response",
                      description:
                        "The claim becomes immediately eligible for a GenLayer judgment.",
                      review,
                    })
                  }
                >
                  Finalize response
                </Button>
              )}
              {canWaive && (
                <Button
                  variant="outline"
                  onClick={() =>
                    setTransaction({
                      tx: waiveInsurerResponseWrite(claim.id),
                      title: "Waive response opportunity",
                      description:
                        "Waiving ends the Insurer's response opportunity and makes the claim eligible for a GenLayer judgment.",
                      review,
                    })
                  }
                >
                  Waive response
                </Button>
              )}
            </Panel>
          )}
        </div>
        <aside className="detail-side">
          <Panel className="action-panel">
            <h3>Claim actions</h3>
            <p>
              Only the authorized participant and valid state can enable these
              controls.
            </p>
            {canAdjudicate && (
              <Button
                variant="light"
                onClick={() =>
                  setTransaction({
                    tx: adjudicateClaimWrite(claim.id),
                    title: "Request GenLayer judgment",
                    description:
                      "The leader and validators will independently fetch and evaluate the committed evidence. The contract will map only the bounded judgment to its deterministic state.",
                    review,
                  })
                }
              >
                Adjudicate claim
              </Button>
            )}
            {canClose && (
              <Button
                variant="outline"
                onClick={() =>
                  setTransaction({
                    tx: closeInsufficientClaimWrite(claim.id),
                    title: "Close unresolved claim",
                    description:
                      "The review window has ended. Closing records the unresolved claim without paying compensation.",
                    review,
                  })
                }
              >
                Close review
              </Button>
            )}
            {canSettle && (
              <>
                <Button
                  variant="light"
                  onClick={() =>
                    setTransaction({
                      tx: settleClaimWrite(claim.id),
                      title: "Review settlement",
                      description:
                        "Settlement requests the fixed compensation for the stored Policyholder. The transfer has no synchronous success result, so inspect final execution before treating payment as complete.",
                      review,
                    })
                  }
                >
                  Request settlement · {formatGen(relatedPolicy.compensation)}
                </Button>
                <p className="tiny-note">
                  Do not retry while an earlier transaction is accepted or
                  pending. Confirm final execution and the stored contract state
                  first.
                </p>
              </>
            )}
            {!canAdjudicate &&
              !canClose &&
              !canSettle &&
              !canReviewEvidence &&
              !canReviewResponse &&
              !canFinalizeReview &&
              !canWaiveReview &&
              !canReconsider && (
                <span className="scan-note">
                  No action is currently available to this wallet.
                </span>
              )}
          </Panel>
          <Panel>
            <div className="panel-head">
              <div>
                <h2>Judgment</h2>
                <p>GenLayer's bounded judgment is separate from payment.</p>
              </div>
              <Send size={18} color="var(--signal)" />
            </div>
            {claim.verdict ? (
              <>
                <div
                  className={`verdict-banner verdict-${claim.verdict.toLowerCase().replaceAll("_", "-")}`}
                  style={{ marginTop: 18 }}
                >
                  <strong>{formatStatus(claim.verdict)}</strong>
                  <StatusPill status={claim.verdict} />
                </div>
                <div className="info-list">
                  <InfoRow
                    label="Reason code"
                    value={formatStatus(claim.reasonCode)}
                  />
                  <InfoRow
                    label="Judged at"
                    value={formatDateTime(claim.judgedAt)}
                  />
                </div>
              </>
            ) : (
              <div
                className="empty-state"
                style={{ minHeight: 170, marginTop: 18 }}
              >
                <p>Judgment has not been recorded yet.</p>
              </div>
            )}
          </Panel>
          <Timeline
            items={[
              {
                label: "Claim filed",
                detail: formatDateTime(claim.createdAt),
                state: "complete",
              },
              {
                label: "Insurer response",
                detail:
                  claim.responseFinalized || claim.responseWaived
                    ? "Response opportunity closed"
                    : responseDeadlineOpen
                      ? `Deadline ${formatDateTime(claim.responseDeadline)}`
                      : "Response window closed",
                state:
                  claim.responseFinalized || claim.responseWaived
                    ? "complete"
                    : responseDeadlineOpen
                      ? "current"
                      : "complete",
              },
              {
                label: "Consensus judgment",
                detail: claim.verdict
                  ? formatStatus(claim.verdict)
                  : canAdjudicate
                    ? "Ready to request judgment"
                    : "Awaiting judgment eligibility",
                state: claim.verdict
                  ? "complete"
                  : canAdjudicate
                    ? "current"
                    : "pending",
              },
              {
                label: "Settlement",
                detail:
                  claim.status === "PAID"
                    ? "Payment state recorded by contract"
                    : claim.verdict === "COVERED"
                      ? "Awaiting settlement request"
                      : claim.verdict === "NOT_COVERED"
                        ? "No compensation due"
                        : "Review window or closure applies",
                state:
                  claim.status === "PAID"
                    ? "complete"
                    : claim.verdict === "COVERED"
                      ? "current"
                      : "pending",
              },
            ]}
          />
        </aside>
      </div>
      {transaction && (
        <TransactionModal
          open={Boolean(transaction)}
          title={transaction.title}
          description={transaction.description}
          tx={transaction.tx}
          review={transaction.review}
          onClose={() => setTransaction(undefined)}
          onAccepted={synchronizeAcceptedState}
          onSuccess={(_status, result) => void afterSuccess(result.message)}
        />
      )}
    </PageContainer>
  );
}

function ResponseForm({
  claimId,
  onSubmit,
}: {
  claimId: string;
  onSubmit: (tx: CoverWrite) => void;
}) {
  const [response, setResponse] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string>();
  const evidence = useEvidenceVerification(url);
  const evidenceReady =
    evidence.state.status === "verified" && evidence.state.url === url.trim();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedUrl = url.trim();
    const responseError = validateText(
      response,
      "Insurer response",
      MAX_RESPONSE,
    );
    if (responseError) return setError(responseError);
    const urlError = validateNetlifyUrl(normalizedUrl);
    if (urlError) return setError(urlError);
    if (!evidenceReady || evidence.state.status !== "verified")
      return setError("Wait for COVER to verify the current evidence URL.");
    setError(undefined);
    onSubmit(
      submitInsurerResponseWrite(
        claimId,
        response.trim(),
        normalizedUrl,
        evidence.state.result.hash,
      ),
    );
  };
  return (
    <Panel>
      <div className="panel-head">
        <div>
          <h2>Submit counterevidence</h2>
          <p>
            Only the stored Insurer can respond once, before the response
            deadline.
          </p>
        </div>
        <Send size={18} color="var(--signal)" />
      </div>
      <form className="form-grid" style={{ marginTop: 22 }} onSubmit={submit}>
        <div className="form-field full">
          <label htmlFor="insurer-response">Response</label>
          <textarea
            id="insurer-response"
            value={response}
            onChange={(event) => setResponse(event.target.value)}
            placeholder="Explain why the action was authorized, excluded, or not causally connected."
          />
        </div>
        <div className="form-field">
          <label htmlFor="counter-url">Counterevidence URL</label>
          <input
            id="counter-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://site.netlify.app/response.json"
          />
          <small>
            COVER fetches the current Netlify response and generates the hash
            automatically.
          </small>
        </div>
        <div className="form-field full">
          <EvidenceVerificationStatus
            verification={evidence.state}
            onRetry={evidence.retry}
          />
          <EvidenceTroubleshooting />
        </div>
        {error && <p className="field-error full">{error}</p>}
        <div className="form-actions full">
          <Button type="submit" variant="light" disabled={!evidenceReady}>
            Review response
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function ReviewEvidenceForm({
  claimId,
  onSubmit,
}: {
  claimId: string;
  onSubmit: (tx: CoverWrite) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string>();
  const evidence = useEvidenceVerification(url);
  const evidenceReady =
    evidence.state.status === "verified" && evidence.state.url === url.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedUrl = url.trim();
    const urlError = validateNetlifyUrl(normalizedUrl);
    if (urlError) return setError(urlError);
    if (!evidenceReady || evidence.state.status !== "verified")
      return setError("Wait for COVER to verify the current evidence URL.");
    setError(undefined);
    onSubmit(
      submitReviewEvidenceWrite(
        claimId,
        normalizedUrl,
        evidence.state.result.hash,
      ),
    );
  };

  return (
    <form className="form-grid" style={{ marginTop: 22 }} onSubmit={submit}>
      <div className="form-field full">
        <label htmlFor="review-evidence-url">Replacement evidence URL</label>
        <input
          id="review-evidence-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://site.netlify.app/review.json"
        />
        <small>
          The current Netlify JSON is fetched and hashed automatically. It does
          not authenticate the underlying incident.
        </small>
      </div>
      <div className="form-field full">
        <EvidenceVerificationStatus
          verification={evidence.state}
          onRetry={evidence.retry}
        />
        <EvidenceTroubleshooting />
      </div>
      {error && <p className="field-error full">{error}</p>}
      <div className="form-actions full">
        <Button type="submit" variant="light" disabled={!evidenceReady}>
          Review replacement evidence
        </Button>
      </div>
    </form>
  );
}

function ReviewResponseForm({
  claimId,
  onSubmit,
}: {
  claimId: string;
  onSubmit: (tx: CoverWrite) => void;
}) {
  const [response, setResponse] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string>();
  const evidence = useEvidenceVerification(url);
  const evidenceReady =
    evidence.state.status === "verified" && evidence.state.url === url.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const responseError = validateText(
      response,
      "Review insurer response",
      MAX_RESPONSE,
    );
    if (responseError) return setError(responseError);
    const normalizedUrl = url.trim();
    const urlError = validateNetlifyUrl(normalizedUrl);
    if (urlError) return setError(urlError);
    if (!evidenceReady || evidence.state.status !== "verified")
      return setError("Wait for COVER to verify the current evidence URL.");
    setError(undefined);
    onSubmit(
      submitReviewResponseWrite(
        claimId,
        response.trim(),
        normalizedUrl,
        evidence.state.result.hash,
      ),
    );
  };

  return (
    <form className="form-grid" style={{ marginTop: 22 }} onSubmit={submit}>
      <div className="form-field full">
        <label htmlFor="review-insurer-response">Review response</label>
        <textarea
          id="review-insurer-response"
          value={response}
          onChange={(event) => setResponse(event.target.value)}
          placeholder="Add material counterevidence or explain why the corrected record does not establish coverage."
        />
      </div>
      <div className="form-field full">
        <label htmlFor="review-counterevidence-url">
          Review counterevidence URL
        </label>
        <input
          id="review-counterevidence-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://site.netlify.app/review-response.json"
        />
      </div>
      <div className="form-field full">
        <EvidenceVerificationStatus
          verification={evidence.state}
          onRetry={evidence.retry}
        />
        <EvidenceTroubleshooting />
      </div>
      {error && <p className="field-error full">{error}</p>}
      <div className="form-actions full">
        <Button type="submit" variant="light" disabled={!evidenceReady}>
          Review insurer response
        </Button>
      </div>
    </form>
  );
}
