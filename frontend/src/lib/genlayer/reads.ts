import { contractRead } from "./client";
import {
  asBigInt,
  asBoolean,
  asNumber,
  asString,
  formatDateTime,
  formatGen,
  formatStatus,
} from "./format";
import type {
  CoverClaim,
  CoverConfig,
  CoverOverview,
  CoverPolicy,
  PolicyStatus,
  ClaimStatus,
  Verdict,
} from "./types";

type RecordValue = Record<string, unknown>;
const MAX_SCAN_RECORDS = 100;
const CHUNK_SIZE = 12;

function optionalString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalBoolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function optionalNumber(value: unknown): number {
  return value === undefined ? 0 : asNumber(value, "optional contract value");
}

function record(value: unknown, field: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Contract returned an invalid ${field}.`);
  }
  return value as RecordValue;
}

function address(value: unknown, field: string): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "as_hex" in value) {
    const hex = (value as { as_hex?: unknown }).as_hex;
    if (typeof hex === "string") return hex;
  }
  throw new Error(`Contract returned an invalid ${field}.`);
}

function mapPolicy(raw: unknown): CoverPolicy {
  const value = record(raw, "policy");
  return {
    id: asBigInt(value.policy_id, "policy id").toString(),
    insurer: address(value.insurer, "insurer"),
    policyholder: address(value.policyholder, "policyholder"),
    insuredAgentId: asString(
      value.insured_agent_id,
      "insured agent identifier",
    ),
    coverageConditions: asString(
      value.coverage_conditions,
      "coverage conditions",
    ),
    exclusions: asString(value.exclusions, "exclusions"),
    compensation: asBigInt(value.compensation_amount, "compensation amount"),
    activationTime: asNumber(value.activation_time, "activation time"),
    expirationTime: asNumber(value.expiration_time, "expiration time"),
    fundedAmount: asBigInt(value.funded_amount, "funded amount"),
    reserveRemaining: asBigInt(value.reserve_remaining, "reserve remaining"),
    outstandingLiability: asBigInt(
      value.outstanding_liability,
      "outstanding liability",
    ),
    status: asString(value.status, "policy status") as PolicyStatus,
    claimId: asBigInt(value.claim_id, "claim id").toString(),
    refundClaimed: asBoolean(value.refund_claimed, "refund status"),
  };
}

function mapClaim(raw: unknown): CoverClaim {
  const value = record(raw, "claim");
  return {
    id: asBigInt(value.claim_id, "claim id").toString(),
    policyId: asBigInt(value.policy_id, "policy id").toString(),
    description: asString(value.description, "claim description"),
    incidentTime: asNumber(value.incident_time, "incident time"),
    evidenceUrl: asString(value.evidence_url, "claim evidence URL"),
    evidenceSha256: asString(value.evidence_sha256, "claim evidence hash"),
    createdAt: asNumber(value.created_at, "claim creation time"),
    responseDeadline: asNumber(value.response_deadline, "response deadline"),
    response: asString(value.response, "insurer response"),
    responseUrl: asString(value.response_url, "response URL"),
    responseSha256: asString(value.response_sha256, "response hash"),
    responseSubmitted: asBoolean(
      value.response_submitted,
      "response submitted status",
    ),
    responseWaived: asBoolean(value.response_waived, "response waiver status"),
    responseFinalized: asBoolean(
      value.response_finalized,
      "response finalized status",
    ),
    reviewDeadline: asNumber(value.review_deadline, "review deadline"),
    judgedAt: asNumber(value.judged_at, "judgment time"),
    verdict: asString(value.verdict, "verdict") as Verdict | "",
    reasonCode: asString(value.reason_code, "reason code"),
    status: asString(value.status, "claim status") as ClaimStatus,
    settlementAttempts: asNumber(
      value.settlement_attempts,
      "settlement attempts",
    ),
    lastSettlementAt: asNumber(
      value.last_settlement_at,
      "last settlement time",
    ),
    initialVerdict: optionalString(value.initial_verdict) as Verdict | "",
    initialReasonCode: optionalString(value.initial_reason_code),
    reviewAttempts: optionalNumber(value.review_attempts),
    reviewEvidenceUrl: optionalString(value.review_evidence_url),
    reviewEvidenceSha256: optionalString(value.review_evidence_sha256),
    reviewEvidenceSubmitted: optionalBoolean(value.review_evidence_submitted),
    reviewResponse: optionalString(value.review_response),
    reviewResponseUrl: optionalString(value.review_response_url),
    reviewResponseSha256: optionalString(value.review_response_sha256),
    reviewResponseSubmitted: optionalBoolean(value.review_response_submitted),
    reviewResponseWaived: optionalBoolean(value.review_response_waived),
    reviewResponseFinalized: optionalBoolean(value.review_response_finalized),
  };
}

export async function readConfig(): Promise<CoverConfig> {
  const raw = record(await contractRead("get_config"), "configuration");
  const strings = (value: unknown, field: string) =>
    Array.isArray(value) ? value.map((item) => asString(item, field)) : [];
  return {
    protocol: asString(raw.protocol, "protocol"),
    nativeToken: asString(raw.native_token, "native token"),
    nativePrecision: asNumber(raw.native_precision, "native precision"),
    runner: asString(raw.runner, "runner"),
    maxFetchedEvidenceBytes: asNumber(
      raw.max_fetched_evidence_bytes,
      "evidence bound",
    ),
    responseWindowSeconds: asNumber(
      raw.response_window_seconds,
      "response window",
    ),
    reviewWindowSeconds: asNumber(raw.review_window_seconds, "review window"),
    verdicts: strings(raw.verdicts, "verdict"),
    policyStates: strings(raw.policy_states, "policy state"),
    claimStates: strings(raw.claim_states, "claim state"),
    evidenceHost: asString(raw.evidence_host, "evidence host"),
    supportsReconsideration: raw.supports_reconsideration === true,
    reviewAttemptLimit:
      raw.review_attempt_limit === undefined
        ? 0
        : asNumber(raw.review_attempt_limit, "review attempt limit"),
  };
}

export async function readPolicy(id: string): Promise<CoverPolicy> {
  return mapPolicy(await contractRead("get_policy", [BigInt(id)]));
}

export async function readClaim(id: string): Promise<CoverClaim> {
  return mapClaim(await contractRead("get_claim", [BigInt(id)]));
}

async function readCount(method: "get_policy_count" | "get_claim_count") {
  return asNumber(await contractRead(method), method);
}

async function readInChunks<T>(
  ids: number[],
  reader: (id: string) => Promise<T>,
): Promise<T[]> {
  const result: T[] = [];
  for (let start = 0; start < ids.length; start += CHUNK_SIZE) {
    const chunk = ids.slice(start, start + CHUNK_SIZE);
    result.push(...(await Promise.all(chunk.map((id) => reader(String(id))))));
  }
  return result;
}

export async function readPolicies(
  limit = MAX_SCAN_RECORDS,
): Promise<{ items: CoverPolicy[]; count: number; limited: boolean }> {
  const count = await readCount("get_policy_count");
  const end = Math.min(count, limit);
  const items = await readInChunks(
    Array.from({ length: end }, (_, index) => count - index),
    readPolicy,
  );
  return { items, count, limited: count > end };
}

export async function readClaims(
  limit = MAX_SCAN_RECORDS,
): Promise<{ items: CoverClaim[]; count: number; limited: boolean }> {
  const count = await readCount("get_claim_count");
  const end = Math.min(count, limit);
  const items = await readInChunks(
    Array.from({ length: end }, (_, index) => count - index),
    readClaim,
  );
  return { items, count, limited: count > end };
}

export async function readOverview(): Promise<CoverOverview> {
  const [policies, claims] = await Promise.all([readPolicies(), readClaims()]);
  return {
    policyCount: policies.count,
    claimCount: claims.count,
    policies: policies.items,
    claims: claims.items,
    scannedPolicies: policies.items.length,
    scannedClaims: claims.items.length,
    scanLimited: policies.limited || claims.limited,
  };
}

export function policySummary(policy: CoverPolicy) {
  return `${formatGen(policy.compensation)} · ${formatStatus(policy.status)} · expires ${formatDateTime(policy.expirationTime)}`;
}
