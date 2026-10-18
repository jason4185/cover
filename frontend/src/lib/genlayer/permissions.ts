import type { CoverClaim, CoverPolicy } from "./types";
import { nowSeconds, sameAddress } from "./format";

export const RECONSIDERATION_GRACE_SECONDS = 24 * 60 * 60;

export function canFileClaim(
  policy: CoverPolicy,
  wallet: string | undefined,
  now = nowSeconds(),
): boolean {
  return (
    sameAddress(wallet, policy.policyholder) &&
    policy.status === "ACTIVE" &&
    policy.claimId === "0" &&
    now <= policy.expirationTime
  );
}

export function canRefundPolicy(
  policy: CoverPolicy,
  claim: CoverClaim | undefined,
  wallet: string | undefined,
  now = nowSeconds(),
): boolean {
  const claimOpen = Boolean(
    claim &&
    [
      "RESPONSE_OPEN",
      "READY_FOR_JUDGMENT",
      "REVIEW_OPEN",
      "SETTLEMENT_PENDING",
    ].includes(claim.status),
  );
  return (
    sameAddress(wallet, policy.insurer) &&
    !policy.refundClaimed &&
    now > policy.expirationTime &&
    !claimOpen &&
    policy.outstandingLiability === 0n &&
    policy.reserveRemaining > 0n
  );
}

export function canSubmitInsurerResponse(
  claim: CoverClaim,
  policy: CoverPolicy,
  wallet: string | undefined,
  now = nowSeconds(),
): boolean {
  return (
    sameAddress(wallet, policy.insurer) &&
    claim.status === "RESPONSE_OPEN" &&
    !claim.responseSubmitted &&
    now < claim.responseDeadline
  );
}

export function canFinalizeInsurerResponse(
  claim: CoverClaim,
  policy: CoverPolicy,
  wallet: string | undefined,
  now = nowSeconds(),
): boolean {
  return (
    sameAddress(wallet, policy.insurer) &&
    claim.status === "RESPONSE_OPEN" &&
    claim.responseSubmitted &&
    !claim.responseFinalized &&
    now < claim.responseDeadline
  );
}

export function canWaiveInsurerResponse(
  claim: CoverClaim,
  policy: CoverPolicy,
  wallet: string | undefined,
  now = nowSeconds(),
): boolean {
  return (
    sameAddress(wallet, policy.insurer) &&
    claim.status === "RESPONSE_OPEN" &&
    !claim.responseSubmitted &&
    now < claim.responseDeadline
  );
}

export function canAdjudicateClaim(
  claim: CoverClaim,
  policy: CoverPolicy,
  wallet: string | undefined,
  now = nowSeconds(),
): boolean {
  const participant =
    sameAddress(wallet, policy.insurer) ||
    sameAddress(wallet, policy.policyholder);
  return (
    participant &&
    (claim.status === "READY_FOR_JUDGMENT" ||
      (claim.status === "RESPONSE_OPEN" && now >= claim.responseDeadline))
  );
}

export function canCloseInsufficientClaim(
  claim: CoverClaim,
  policy: CoverPolicy,
  wallet: string | undefined,
  now = nowSeconds(),
): boolean {
  const participant =
    sameAddress(wallet, policy.insurer) ||
    sameAddress(wallet, policy.policyholder);
  if (!participant || claim.status !== "REVIEW_OPEN") return false;
  if (now < claim.reviewDeadline) return false;
  if (claim.reviewAttempts > 0 || !claim.reviewEvidenceSubmitted) return true;
  return now >= claim.reviewDeadline + RECONSIDERATION_GRACE_SECONDS;
}

export function canSettleClaim(
  claim: CoverClaim,
  wallet: string | undefined,
): boolean {
  return Boolean(wallet) && claim.status === "SETTLEMENT_PENDING";
}

export function canSubmitReviewEvidence(
  claim: CoverClaim,
  policy: CoverPolicy,
  wallet: string | undefined,
  now = nowSeconds(),
): boolean {
  return (
    sameAddress(wallet, policy.policyholder) &&
    claim.status === "REVIEW_OPEN" &&
    claim.reviewAttempts === 0 &&
    !claim.reviewEvidenceSubmitted &&
    now < claim.reviewDeadline
  );
}

export function canSubmitReviewResponse(
  claim: CoverClaim,
  policy: CoverPolicy,
  wallet: string | undefined,
  now = nowSeconds(),
): boolean {
  return (
    sameAddress(wallet, policy.insurer) &&
    claim.status === "REVIEW_OPEN" &&
    claim.reviewAttempts === 0 &&
    !claim.reviewResponseSubmitted &&
    !claim.reviewResponseWaived &&
    now < claim.reviewDeadline
  );
}

export function canFinalizeReviewResponse(
  claim: CoverClaim,
  policy: CoverPolicy,
  wallet: string | undefined,
  now = nowSeconds(),
): boolean {
  return (
    sameAddress(wallet, policy.insurer) &&
    claim.status === "REVIEW_OPEN" &&
    claim.reviewAttempts === 0 &&
    claim.reviewResponseSubmitted &&
    !claim.reviewResponseFinalized &&
    now < claim.reviewDeadline
  );
}

export function canWaiveReviewResponse(
  claim: CoverClaim,
  policy: CoverPolicy,
  wallet: string | undefined,
  now = nowSeconds(),
): boolean {
  return (
    sameAddress(wallet, policy.insurer) &&
    claim.status === "REVIEW_OPEN" &&
    claim.reviewAttempts === 0 &&
    !claim.reviewResponseSubmitted &&
    !claim.reviewResponseWaived &&
    now < claim.reviewDeadline
  );
}

export function canReconsiderClaim(
  claim: CoverClaim,
  policy: CoverPolicy,
  wallet: string | undefined,
  now = nowSeconds(),
): boolean {
  const participant =
    sameAddress(wallet, policy.insurer) ||
    sameAddress(wallet, policy.policyholder);
  const responseStageComplete =
    claim.reviewResponseFinalized ||
    claim.reviewResponseWaived ||
    now >= claim.reviewDeadline;
  const reconsiderationWindowOpen =
    now < claim.reviewDeadline + RECONSIDERATION_GRACE_SECONDS;
  return (
    participant &&
    claim.status === "REVIEW_OPEN" &&
    claim.reviewAttempts === 0 &&
    claim.reviewEvidenceSubmitted &&
    responseStageComplete &&
    reconsiderationWindowOpen
  );
}
