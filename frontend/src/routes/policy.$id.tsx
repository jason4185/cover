import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { FileUp, LockKeyhole, ShieldAlert } from "lucide-react";
import { PageContainer, PageIntro } from "@/components/cover/Shell";
import {
  EvidenceTroubleshooting,
  EvidenceVerificationStatus,
} from "@/components/cover/EvidenceVerification";
import { TransactionModal } from "@/components/cover/TransactionModal";
import {
  Button,
  ErrorState,
  InfoRow,
  LoadingState,
  Panel,
  StatusPill,
  Timeline,
  UnconfiguredState,
} from "@/components/cover/UI";
import { useClaim, useCoverRefresh, usePolicy } from "@/hooks/use-cover-data";
import { readClaim, readPolicy } from "@/lib/genlayer/reads";
import { readUntilAcceptedState } from "@/lib/genlayer/accepted";
import { COVER_CONFIGURED } from "@/lib/genlayer/config";
import {
  formatAddress,
  formatDateTime,
  formatDuration,
  formatGen,
  formatStatus,
} from "@/lib/genlayer/format";
import {
  validateIncidentTime,
  validateText,
  MAX_DESCRIPTION,
} from "@/lib/genlayer/validation";
import { validateNetlifyUrl } from "@/lib/genlayer/evidence";
import { useEvidenceVerification } from "@/hooks/use-evidence-verification";
import { canFileClaim, canRefundPolicy } from "@/lib/genlayer/permissions";
import { useWallet } from "@/lib/genlayer/wallet";
import { fileClaimWrite, refundPolicyWrite } from "@/lib/genlayer/writes";
import type { CoverWrite } from "@/lib/genlayer/types";

export const Route = createFileRoute("/policy/$id")({
  component: PolicyDetailPage,
});

type TransactionState = {
  tx: CoverWrite;
  title: string;
  description: string;
  review: ReactNode;
  userValue?: bigint | undefined;
};

function PolicyDetailPage() {
  const { id } = Route.useParams();
  const policy = usePolicy(id);
  const value = policy.data;
  const claim = useClaim(value?.claimId ?? "0");
  const wallet = useWallet();
  const refresh = useCoverRefresh();
  const [transaction, setTransaction] = useState<TransactionState>();
  const [success, setSuccess] = useState<string>();

  const canFile = Boolean(value && canFileClaim(value, wallet.address));
  const claimStateKnown = Boolean(
    value &&
    (value.claimId === "0" ||
      (claim.data !== undefined && !claim.isLoading && !claim.error)),
  );
  const canRefund = Boolean(
    value &&
    claimStateKnown &&
    canRefundPolicy(value, claim.data, wallet.address),
  );
  const closeTransaction = () => setTransaction(undefined);
  const afterSuccess = async (message: string) => {
    setTransaction(undefined);
    setSuccess(message);
    await refresh();
    await policy.refetch();
    if (value?.claimId && value.claimId !== "0") await claim.refetch();
  };

  const synchronizeAcceptedState = async () => {
    if (!transaction || !value) {
      return {
        confirmed: false,
        message:
          "The transaction was accepted, but the affected policy could not be identified for synchronization.",
      };
    }
    await refresh();
    if (transaction.tx.method === "file_claim") {
      const result = await readUntilAcceptedState(
        async () => {
          const currentPolicy = await readPolicy(value.id);
          const currentClaim =
            currentPolicy.claimId === "0"
              ? undefined
              : await readClaim(currentPolicy.claimId);
          return { currentPolicy, currentClaim };
        },
        ({ currentPolicy, currentClaim }) =>
          currentPolicy.claimId !== "0" && currentClaim !== undefined,
      );
      await refresh();
      await policy.refetch();
      return {
        confirmed: result.confirmed,
        message: result.confirmed
          ? "Claim accepted and visible in the policy record. The claim is now subject to the Insurer response process."
          : "Claim accepted, but the new claim record is not visible yet. Close this review and refresh the policy before continuing.",
      };
    }

    const result = await readUntilAcceptedState(
      () => readPolicy(value.id),
      (currentPolicy) =>
        currentPolicy.status === "REFUNDED" && currentPolicy.refundClaimed,
    );
    await refresh();
    await policy.refetch();
    return {
      confirmed: result.confirmed,
      message: result.confirmed
        ? "Refund accepted and the policy now shows a released reserve. The external GEN transfer is not independently confirmed by this application."
        : "Refund accepted, but the updated policy state is not visible yet. Do not submit another refund until the contract state is refreshed.",
    };
  };

  if (!COVER_CONFIGURED)
    return (
      <PageContainer>
        <PageIntro
          eyebrow="Policy record"
          title="A contract address is required."
          description="This page is ready for Studio Next, but no COVER deployment address has been supplied."
        />
        <UnconfiguredState />
      </PageContainer>
    );
  if (policy.isLoading)
    return (
      <PageContainer>
        <LoadingState label="Reading policy" />
      </PageContainer>
    );
  if (policy.error || !value)
    return (
      <PageContainer>
        <ErrorState
          message={policy.error?.message ?? "Policy not found."}
          retry={() => void policy.refetch()}
        />
      </PageContainer>
    );

  return (
    <PageContainer>
      <PageIntro
        eyebrow={`Policy / ${value.id.padStart(4, "0")}`}
        title={value.insuredAgentId}
        description="A funded policy for one AI agent, one Policyholder, immutable terms, and a fixed GEN compensation amount."
        action={<StatusPill status={value.status} />}
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
          <LockKeyhole size={17} />
          <span>{success}</span>
        </div>
      )}
      <div className="detail-layout">
        <div className="detail-main">
          <Panel>
            <div className="panel-head">
              <div>
                <h2>Policy terms</h2>
                <p>
                  These terms were stored when the policy was created and cannot
                  be changed in COVER V1.
                </p>
              </div>
              <ShieldAlert size={19} color="var(--signal)" />
            </div>
            <div className="condition-card" style={{ marginTop: 20 }}>
              <h3>Coverage conditions</h3>
              <p>{value.coverageConditions}</p>
            </div>
            <div className="condition-card" style={{ marginTop: 12 }}>
              <h3>Exclusions</h3>
              <p>{value.exclusions}</p>
            </div>
          </Panel>
          <Panel>
            <div className="panel-head">
              <div>
                <h2>Funding and timing</h2>
                <p>
                  Amounts are displayed in GEN and stored as exact integer base
                  units.
                </p>
              </div>
            </div>
            <div className="info-list">
              <InfoRow
                label="Compensation"
                value={formatGen(value.compensation)}
              />
              <InfoRow
                label="Reserve remaining"
                value={formatGen(value.reserveRemaining)}
              />
              <InfoRow
                label="Outstanding liability"
                value={formatGen(value.outstandingLiability)}
              />
              <InfoRow
                label="Duration"
                value={formatDuration(
                  value.expirationTime - value.activationTime,
                )}
              />
              <InfoRow
                label="Activated"
                value={formatDateTime(value.activationTime)}
              />
              <InfoRow
                label="Expires"
                value={formatDateTime(value.expirationTime)}
              />
            </div>
          </Panel>
          {value.claimId !== "0" && claim.data && (
            <Panel>
              <div className="panel-head">
                <div>
                  <h2>Existing claim</h2>
                  <p>Each policy permits one claim.</p>
                </div>
                <StatusPill status={claim.data.verdict || claim.data.status} />
              </div>
              <div className="info-list">
                <InfoRow
                  label="Claim id"
                  value={
                    <Link
                      className="text-link"
                      to="/claim/$id"
                      params={{ id: claim.data.id }}
                    >
                      #{claim.data.id} ↗
                    </Link>
                  }
                />
                <InfoRow
                  label="Claim status"
                  value={formatStatus(claim.data.status)}
                />
                <InfoRow
                  label="Judgment"
                  value={claim.data.verdict || "No judgment yet"}
                />
                <InfoRow
                  label="Response deadline"
                  value={formatDateTime(claim.data.responseDeadline)}
                />
              </div>
            </Panel>
          )}
          {canFile && (
            <ClaimForm
              policyId={value.id}
              activationTime={value.activationTime}
              expirationTime={value.expirationTime}
              onSubmit={(request) =>
                setTransaction({
                  tx: request.tx,
                  userValue: request.userValue,
                  title: "Review claim filing",
                  description:
                    "The claim will store the incident description, claimed time, Netlify URL, and SHA-256 commitment on-chain. GenLayer evaluates the evidence later.",
                  review: (
                    <div className="review-stack">
                      <div className="review-item">
                        <span>Policy</span>
                        <strong>#{value.id}</strong>
                      </div>
                      <div className="review-item">
                        <span>Funding effect</span>
                        <strong>
                          Filing does not decide coverage or payment
                        </strong>
                      </div>
                      <div className="review-item">
                        <span>Evidence</span>
                        <strong>
                          Fetched and verified during GenLayer judgment
                        </strong>
                      </div>
                    </div>
                  ),
                })
              }
            />
          )}
          {value.claimId !== "0" && !claim.data && claim.isLoading && (
            <LoadingState label="Reading claim" />
          )}
        </div>
        <aside className="detail-side">
          <Panel className="action-panel">
            <h3>Policy actions</h3>
            <p>Only actions valid under the current state are shown.</p>
            {canFile && (
              <span className="status-pill status-positive">
                The Policyholder may file now
              </span>
            )}
            {canRefund && (
              <Button
                variant="light"
                onClick={() =>
                  setTransaction({
                    tx: refundPolicyWrite(value.id),
                    title: "Review reserve refund",
                    description:
                      "The Insurer will request the unused reserve after expiration and after every claim obligation has ended.",
                    review: (
                      <div className="review-stack">
                        <div className="review-item">
                          <span>Recipient</span>
                          <strong>
                            Insurer · {formatAddress(value.insurer)}
                          </strong>
                        </div>
                        <div className="review-item">
                          <span>Refund amount</span>
                          <strong>{formatGen(value.reserveRemaining)}</strong>
                        </div>
                        <div className="review-item">
                          <span>Finalization</span>
                          <strong>
                            Accepted state updates the reserve record; transfer
                            receipt remains unverified
                          </strong>
                        </div>
                      </div>
                    ),
                  })
                }
              >
                Request refund · {formatGen(value.reserveRemaining)}
              </Button>
            )}
            {value.claimId !== "0" && (
              <Link
                className="button button-outline"
                to="/claim/$id"
                params={{ id: value.claimId }}
              >
                Open claim record
              </Link>
            )}
            {!canFile && !canRefund && value.status !== "ACTIVE" && (
              <span className="scan-note">
                No policy action is currently available to this wallet.
              </span>
            )}
          </Panel>
          <Panel>
            <div className="panel-head">
              <div>
                <h2>Parties</h2>
                <p>The contract stores these wallet addresses.</p>
              </div>
            </div>
            <div className="info-list">
              <InfoRow
                label="Insurer"
                value={
                  <span className="mono" title={value.insurer}>
                    {formatAddress(value.insurer)}
                  </span>
                }
              />
              <InfoRow
                label="Policyholder"
                value={
                  <span className="mono" title={value.policyholder}>
                    {formatAddress(value.policyholder)}
                  </span>
                }
              />
            </div>
          </Panel>
          <Timeline
            items={[
              {
                label: "Funded and active",
                detail: formatDateTime(value.activationTime),
                state: value.status === "ACTIVE" ? "current" : "complete",
              },
              {
                label: "Claim window",
                detail:
                  value.claimId === "0"
                    ? "No claim filed"
                    : `Claim ${value.claimId} recorded`,
                state: value.claimId === "0" ? "pending" : "complete",
              },
              {
                label: "Resolution",
                detail:
                  value.status === "ACTIVE"
                    ? "Awaiting policy event"
                    : value.status,
                state: value.status === "ACTIVE" ? "pending" : "current",
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
          userValue={transaction.userValue}
          review={transaction.review}
          onClose={closeTransaction}
          onAccepted={synchronizeAcceptedState}
          onSuccess={(_status, result) => void afterSuccess(result.message)}
        />
      )}
    </PageContainer>
  );
}

function ClaimForm({
  policyId,
  activationTime,
  expirationTime,
  onSubmit,
}: {
  policyId: string;
  activationTime: number;
  expirationTime: number;
  onSubmit: (request: { tx: CoverWrite; userValue?: bigint }) => void;
}) {
  const [description, setDescription] = useState("");
  const [incidentTime, setIncidentTime] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string>();
  const evidence = useEvidenceVerification(url);
  const evidenceReady =
    evidence.state.status === "verified" && evidence.state.url === url.trim();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedUrl = url.trim();
    const descriptionError = validateText(
      description,
      "Incident description",
      MAX_DESCRIPTION,
    );
    if (descriptionError) return setError(descriptionError);
    const timeResult = validateIncidentTime(
      incidentTime,
      activationTime,
      expirationTime,
    );
    if ("error" in timeResult) return setError(timeResult.error);
    const urlError = validateNetlifyUrl(normalizedUrl);
    if (urlError) return setError(urlError);
    if (!evidenceReady || evidence.state.status !== "verified")
      return setError("Wait for COVER to verify the current evidence URL.");
    setError(undefined);
    onSubmit({
      tx: fileClaimWrite(
        policyId,
        description.trim(),
        timeResult.value,
        normalizedUrl,
        evidence.state.result.hash,
      ),
    });
  };
  return (
    <Panel>
      <div className="panel-head">
        <div>
          <h2>File a claim</h2>
          <p>
            Use a simulated incident record and a committed Netlify JSON
            reference.
          </p>
        </div>
        <FileUp size={19} color="var(--signal)" />
      </div>
      <form className="form-grid" style={{ marginTop: 22 }} onSubmit={submit}>
        <div className="form-field full">
          <label htmlFor="incident-description">Incident description</label>
          <textarea
            id="incident-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe the unauthorized action and the covered loss."
          />
        </div>
        <div className="form-field">
          <label htmlFor="incident-time">Claimed incident time</label>
          <input
            id="incident-time"
            type="datetime-local"
            value={incidentTime}
            onChange={(event) => setIncidentTime(event.target.value)}
          />
          <small>This timestamp is an allegation, not independent proof.</small>
        </div>
        <div className="form-field">
          <label htmlFor="evidence-url">Netlify HTTPS evidence URL</label>
          <input
            id="evidence-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://site.netlify.app/case.json"
          />
          <small>
            COVER fetches this URL server-side, checks the raw response, and
            generates the commitment automatically.
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
            Review claim filing
          </Button>
        </div>
      </form>
    </Panel>
  );
}
