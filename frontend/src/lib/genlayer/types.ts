export type PolicyStatus = "ACTIVE" | "REVIEW" | "RESOLVED" | "REFUNDED";
export type ClaimStatus =
  | "RESPONSE_OPEN"
  | "READY_FOR_JUDGMENT"
  | "SETTLEMENT_PENDING"
  | "REVIEW_OPEN"
  | "JUDGED"
  | "PAID"
  | "CLOSED";
export type Verdict = "COVERED" | "NOT_COVERED" | "INSUFFICIENT_EVIDENCE";

export type CoverConfig = {
  protocol: string;
  nativeToken: string;
  nativePrecision: number;
  runner: string;
  maxFetchedEvidenceBytes: number;
  responseWindowSeconds: number;
  reviewWindowSeconds: number;
  verdicts: string[];
  policyStates: string[];
  claimStates: string[];
  evidenceHost: string;
  supportsReconsideration: boolean;
  reviewAttemptLimit: number;
};

export type CoverPolicy = {
  id: string;
  insurer: string;
  policyholder: string;
  insuredAgentId: string;
  coverageConditions: string;
  exclusions: string;
  compensation: bigint;
  activationTime: number;
  expirationTime: number;
  fundedAmount: bigint;
  reserveRemaining: bigint;
  outstandingLiability: bigint;
  status: PolicyStatus;
  claimId: string;
  refundClaimed: boolean;
};

export type CoverClaim = {
  id: string;
  policyId: string;
  description: string;
  incidentTime: number;
  evidenceUrl: string;
  evidenceSha256: string;
  createdAt: number;
  responseDeadline: number;
  response: string;
  responseUrl: string;
  responseSha256: string;
  responseSubmitted: boolean;
  responseWaived: boolean;
  responseFinalized: boolean;
  reviewDeadline: number;
  judgedAt: number;
  verdict: Verdict | "";
  reasonCode: string;
  status: ClaimStatus;
  settlementAttempts: number;
  lastSettlementAt: number;
  initialVerdict: Verdict | "";
  initialReasonCode: string;
  reviewAttempts: number;
  reviewEvidenceUrl: string;
  reviewEvidenceSha256: string;
  reviewEvidenceSubmitted: boolean;
  reviewResponse: string;
  reviewResponseUrl: string;
  reviewResponseSha256: string;
  reviewResponseSubmitted: boolean;
  reviewResponseWaived: boolean;
  reviewResponseFinalized: boolean;
};

export type CoverOverview = {
  policyCount: number;
  claimCount: number;
  policies: CoverPolicy[];
  claims: CoverClaim[];
  scannedPolicies: number;
  scannedClaims: number;
  scanLimited: boolean;
};

export type CoverWrite = Extract<
  import("@genlayer/transaction-kit").SubmitInput,
  { kind: "write" }
>;
export type CoverWriteRequest = { tx: CoverWrite; userValue?: bigint };
