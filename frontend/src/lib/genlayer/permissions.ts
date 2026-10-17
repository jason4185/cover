import type { CoverClaim, CoverPolicy } from "./types";
import { nowSeconds, sameAddress } from "./format";

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
  return (
    participant && claim.status === "REVIEW_OPEN" && now >= claim.reviewDeadline
  );
}

export function canSettleClaim(
  claim: CoverClaim,
  wallet: string | undefined,
): boolean {
  return Boolean(wallet) && claim.status === "SETTLEMENT_PENDING";
}
