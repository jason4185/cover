import type { CalldataEncodable } from "genlayer-js/types";
import type { CoverWrite, CoverWriteRequest } from "./types";
import { requireCoverAddress } from "./config";
import { toCalldataAddress } from "./client";

function write(method: string, args: CalldataEncodable[] = []): CoverWrite {
  return { kind: "write", address: requireCoverAddress(), method, args };
}

export function createPolicyWrite(
  policyholder: string,
  agentId: string,
  conditions: string,
  exclusions: string,
  compensation: bigint,
  durationSeconds: bigint,
): CoverWriteRequest {
  return {
    tx: write("create_policy", [
      toCalldataAddress(policyholder),
      agentId,
      conditions,
      exclusions,
      compensation,
      durationSeconds,
    ]),
    userValue: compensation,
  };
}

export const fileClaimWrite = (
  policyId: string,
  description: string,
  incidentTime: bigint,
  evidenceUrl: string,
  evidenceSha256: string,
) =>
  write("file_claim", [
    BigInt(policyId),
    description,
    incidentTime,
    evidenceUrl,
    evidenceSha256,
  ]);

export const submitInsurerResponseWrite = (
  claimId: string,
  response: string,
  counterevidenceUrl: string,
  counterevidenceSha256: string,
) =>
  write("submit_insurer_response", [
    BigInt(claimId),
    response,
    counterevidenceUrl,
    counterevidenceSha256,
  ]);

export const finalizeInsurerResponseWrite = (claimId: string) =>
  write("finalize_insurer_response", [BigInt(claimId)]);

export const waiveInsurerResponseWrite = (claimId: string) =>
  write("waive_insurer_response", [BigInt(claimId)]);
export const submitReviewEvidenceWrite = (
  claimId: string,
  evidenceUrl: string,
  evidenceSha256: string,
) =>
  write("submit_review_evidence", [
    BigInt(claimId),
    evidenceUrl,
    evidenceSha256,
  ]);
export const submitReviewResponseWrite = (
  claimId: string,
  response: string,
  counterevidenceUrl: string,
  counterevidenceSha256: string,
) =>
  write("submit_review_response", [
    BigInt(claimId),
    response,
    counterevidenceUrl,
    counterevidenceSha256,
  ]);
export const finalizeReviewResponseWrite = (claimId: string) =>
  write("finalize_review_response", [BigInt(claimId)]);
export const waiveReviewResponseWrite = (claimId: string) =>
  write("waive_review_response", [BigInt(claimId)]);
export const reconsiderClaimWrite = (claimId: string) =>
  write("reconsider_claim", [BigInt(claimId)]);

export const adjudicateClaimWrite = (claimId: string) =>
  write("adjudicate_claim", [BigInt(claimId)]);
export const closeInsufficientClaimWrite = (claimId: string) =>
  write("close_insufficient_claim", [BigInt(claimId)]);
export const settleClaimWrite = (claimId: string) =>
  write("settle_claim", [BigInt(claimId)]);
export const refundPolicyWrite = (policyId: string) =>
  write("refund_policy", [BigInt(policyId)]);
