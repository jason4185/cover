import { describe, expect, it } from "vitest";
import {
  canAdjudicateClaim,
  canFileClaim,
  canRefundPolicy,
  canSubmitInsurerResponse,
} from "./permissions";
import type { CoverClaim, CoverPolicy } from "./types";

const insurer = "0x1111111111111111111111111111111111111111";
const holder = "0x2222222222222222222222222222222222222222";
const policy: CoverPolicy = {
  id: "1",
  insurer,
  policyholder: holder,
  insuredAgentId: "agent",
  coverageConditions: "conditions",
  exclusions: "none",
  compensation: 10n,
  activationTime: 100,
  expirationTime: 1000,
  fundedAmount: 10n,
  reserveRemaining: 10n,
  outstandingLiability: 0n,
  status: "ACTIVE",
  claimId: "0",
  refundClaimed: false,
};
const claim: CoverClaim = {
  id: "1",
  policyId: "1",
  description: "incident",
  incidentTime: 200,
  evidenceUrl: "https://case.netlify.app/evidence.json",
  evidenceSha256: "a".repeat(64),
  createdAt: 300,
  responseDeadline: 400,
  response: "",
  responseUrl: "",
  responseSha256: "",
  responseSubmitted: false,
  responseWaived: false,
  responseFinalized: false,
  reviewDeadline: 0,
  judgedAt: 0,
  verdict: "",
  reasonCode: "",
  status: "RESPONSE_OPEN",
  settlementAttempts: 0,
  lastSettlementAt: 0,
};

describe("permission-based action visibility", () => {
  it("lets only the stored holder file an active policy once", () => {
    expect(canFileClaim(policy, holder, 500)).toBe(true);
    expect(canFileClaim(policy, insurer, 500)).toBe(false);
    expect(canFileClaim({ ...policy, claimId: "1" }, holder, 500)).toBe(false);
  });

  it("keeps response and judgment roles bounded", () => {
    expect(canSubmitInsurerResponse(claim, policy, insurer, 350)).toBe(true);
    expect(canSubmitInsurerResponse(claim, policy, holder, 350)).toBe(false);
    expect(canAdjudicateClaim(claim, policy, holder, 350)).toBe(false);
    expect(canAdjudicateClaim(claim, policy, holder, 401)).toBe(true);
  });

  it("does not release an unexpired or encumbered reserve", () => {
    expect(canRefundPolicy(policy, undefined, insurer, 1001)).toBe(true);
    expect(
      canRefundPolicy(
        policy,
        { ...claim, status: "SETTLEMENT_PENDING" },
        insurer,
        1001,
      ),
    ).toBe(false);
    expect(canRefundPolicy(policy, undefined, holder, 1001)).toBe(false);
  });
});
