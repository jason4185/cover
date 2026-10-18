import { describe, expect, it } from "vitest";
import {
  adjudicateClaimWrite,
  closeInsufficientClaimWrite,
  createPolicyWrite,
  fileClaimWrite,
  finalizeInsurerResponseWrite,
  refundPolicyWrite,
  settleClaimWrite,
  submitInsurerResponseWrite,
  waiveInsurerResponseWrite,
} from "./writes";

const policyholder = "0x2222222222222222222222222222222222222222";
const hash = "a".repeat(64);

describe("COVER write builders", () => {
  it("matches create_policy's six arguments and exact GEN value", () => {
    const request = createPolicyWrite(
      policyholder,
      "agent-01",
      "unauthorized action causes covered loss",
      "authorized actions",
      2_500_000_000_000_000_000n,
      86_400n,
    );
    expect(request.tx).toMatchObject({
      kind: "write",
      address: "0x0982ebee0aA80Ed50c51903186ae5765e06879d8",
      method: "create_policy",
    });
    expect(request.tx.args).toHaveLength(6);
    expect(request.userValue).toBe(2_500_000_000_000_000_000n);
  });

  it("uses only the deployed public write methods", () => {
    const claimWrite = fileClaimWrite(
      "1",
      "incident",
      100n,
      "https://case.netlify.app/evidence.json",
      hash,
    );
    const responseWrite = submitInsurerResponseWrite(
      "1",
      "response",
      "https://case.netlify.app/response.json",
      hash,
    );
    expect(claimWrite.args).toEqual([
      1n,
      "incident",
      100n,
      "https://case.netlify.app/evidence.json",
      hash,
    ]);
    expect(responseWrite.args).toEqual([
      1n,
      "response",
      "https://case.netlify.app/response.json",
      hash,
    ]);
    const writes = [
      claimWrite,
      responseWrite,
      finalizeInsurerResponseWrite("1"),
      waiveInsurerResponseWrite("1"),
      adjudicateClaimWrite("1"),
      closeInsufficientClaimWrite("1"),
      settleClaimWrite("1"),
      refundPolicyWrite("1"),
    ];
    expect(writes.map((write) => write.method)).toEqual([
      "file_claim",
      "submit_insurer_response",
      "finalize_insurer_response",
      "waive_insurer_response",
      "adjudicate_claim",
      "close_insufficient_claim",
      "settle_claim",
      "refund_policy",
    ]);
  });
});
