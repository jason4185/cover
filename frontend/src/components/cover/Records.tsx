import { ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { CoverClaim, CoverPolicy } from "@/lib/genlayer/types";
import { formatDate, formatGen, formatStatus } from "@/lib/genlayer/format";
import { AddressValue, StatusPill } from "./UI";

export function PolicyCard({ policy }: { policy: CoverPolicy }) {
  return (
    <Link to="/policy/$id" params={{ id: policy.id }} className="record-card">
      <div>
        <div className="record-top">
          <span className="record-id">
            POLICY / {policy.id.padStart(4, "0")}
          </span>
          <StatusPill status={policy.status} />
        </div>
        <h3>{policy.insuredAgentId}</h3>
        <p>
          One Insurer funds a fixed compensation commitment for a designated
          Policyholder.
        </p>
      </div>
      <div className="record-footer">
        <div>
          <span className="eyebrow">Coverage</span>
          <strong>{formatGen(policy.compensation)}</strong>
        </div>
        <div>
          <span className="eyebrow">Expires</span>
          <strong>{formatDate(policy.expirationTime)}</strong>
        </div>
        <ArrowUpRight size={17} />
      </div>
    </Link>
  );
}

export function ClaimCard({ claim }: { claim: CoverClaim }) {
  return (
    <Link
      to="/claim/$id"
      params={{ id: claim.id }}
      className="record-card claim-card"
    >
      <div>
        <div className="record-top">
          <span className="record-id">CLAIM / {claim.id.padStart(4, "0")}</span>
          <StatusPill status={claim.verdict || claim.status} />
        </div>
        <h3 className="claim-excerpt">{claim.description}</h3>
        <p>
          Policy {claim.policyId} · {formatStatus(claim.status)}
        </p>
      </div>
      <div className="record-footer">
        <div>
          <span className="eyebrow">Evidence</span>
          <strong>{claim.evidenceUrl ? "Committed" : "Missing"}</strong>
        </div>
        <div>
          <span className="eyebrow">Filed</span>
          <strong>{formatDate(claim.createdAt)}</strong>
        </div>
        <ArrowUpRight size={17} />
      </div>
    </Link>
  );
}

export function RecordMeta({ policy }: { policy: CoverPolicy }) {
  return (
    <div className="record-meta">
      <span>
        Insurer <AddressValue value={policy.insurer} />
      </span>
      <span>
        Policyholder <AddressValue value={policy.policyholder} />
      </span>
      <span>{formatStatus(policy.status)}</span>
    </div>
  );
}
