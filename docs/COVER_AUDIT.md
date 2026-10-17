# COVER V1 Adversarial Audit

Audit date: 2026-10-17

## Scope and references

This audit covers `contracts/cover.py`, the local host tests, and the V1 lifecycle. The installed `genlayer-dev:write-contract` skill was loaded first and used as the API and storage authority. GAVEL was the primary read-only reference for `gl.vm.run_nondet`, independent validator evaluation, raw evidence verification, and `_Recipient(...).emit_transfer(value=amount)`. PITCH was used as a secondary reference for bounded semantic output and deterministic settlement. Neither reference project was modified.

The required runner pin is:

```text
py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng
```

## Executive conclusion

COVER has a bounded V1 insurance lifecycle and a substantive custom consensus validator. The validator independently re-fetches both frozen evidence commitments, verifies raw hashes, parses the evidence, enforces the claimant evidence's insured-agent identity binding, and reruns the semantic proposal; it does not merely validate the leader's JSON shape. Deterministic code controls authorization, deadlines, fixed compensation, recipients, reserve movement, liability, claim states, and refund eligibility.

The contract is suitable for configured Studio Next semantic and settlement testing, but it is not signed off for live funds. The pinned runner archive is unavailable in this workspace, so SDK validation and genuine multi-validator consensus could not be executed. More importantly, `emit_transfer` exposes no synchronous transfer result. If a deployment preserves COVER's pre-transfer state while an emitted payout or refund later fails or is refunded, the contract cannot detect or repair that outcome. This limitation is explicitly retained and must be resolved by a runtime-level transfer test or a supported callback/receipt mechanism before production use.

## Findings

### High

#### H-01 — Native transfer outcome is not observable in-contract

Status: unresolved runner limitation.

`settle_claim` and `refund_policy` perform effects-first accounting and then call the GAVEL-compatible `_Recipient(...).emit_transfer(value=amount)`. This prevents a normal reentrant call from observing claimable state, and committed state rejects duplicate calls. However, the API has no synchronous success/failure result. If the external transfer fails after `CLAIM_PAID`/`REFUNDED` and zeroed accounting is committed, the policyholder or insurer can be left unpaid while the funds are no longer claimable. If a transaction fails and rolls back all state, a caller may invoke the same guarded operation again only after checking the finalized execution result and confirming state is still eligible.

No unsafe automatic retry was added. The contract cannot safely distinguish an unresolved accepted transaction from a final failed transfer, so it cannot guarantee a retry without risking duplicate payment. This must be tested on the exact runner before live funding.

#### H-02 — Required pinned runner validation is blocked

Status: unresolved verification blocker, not a contract code defect.

`genvm-lint lint` passed, but `genvm-lint check`/`validate` could not load the pinned SDK archive because the exact runner tarball is absent from the local runner cache. Direct tests fail before deployment for the same missing-runner reason. No genuine Studio Next validator or final GEN transfer execution was claimed as passed.

#### H-03 — Claimant evidence was not bound to the insured agent

Status: fixed in source; deployed address remains unpatched.

The original contract placed the policy's `insured_agent_id` in the semantic prompt but did not compare it with the verified evidence JSON. A different agent could therefore receive `COVERED` if leader and validator independently made the same semantic mistake. The live `agent-01` versus `cover-test-agent-01` approval exposed this gap.

The correction deterministically requires a valid top-level `insured_agent` to exactly equal the immutable policy identifier. When present, `original_instruction.agent` and record-level `agent`/`actor` references must also be valid and equal to that top-level value. An explicit top-level mismatch becomes `NOT_COVERED` with `UNAUTHORIZED_ACTION_NOT_ESTABLISHED`; missing, malformed, or contradictory identity becomes `INSUFFICIENT_EVIDENCE`. Optional insurer counterevidence is not required to contain an agent identifier.

### Medium

#### M-01 — Retry entry point implied an unsafe guarantee

Status: fixed.

The prior public `retry_settlement` method was only an alias of `settle_claim`, while transfer success was not observable. It could be interpreted as a safe retry API during an accepted-but-not-finalized transaction. The alias was removed. A caller may repeat `settle_claim` only after a finalized failed transaction proves that `SETTLEMENT_PENDING` remains stored.

#### M-02 — Malformed Netlify host labels were accepted

Status: fixed.

The URL guard already rejected non-HTTPS URLs, credentials, ports, fragments, backslashes, whitespace, and non-Netlify suffixes. It now also rejects empty, leading-hyphen, and trailing-hyphen subdomain labels.

#### M-03 — An abandoned claim could keep reserve locked indefinitely

Status: fixed.

Previously, only the policyholder could invoke `adjudicate_claim`, even after the insurer response deadline. A policyholder who filed and then disappeared could therefore leave the insurer's reserve in `RESPONSE_OPEN` forever. Either stored policy participant may now invoke adjudication after response finalization/waiver or after the response deadline; neither can invoke it during the open response window.

#### M-04 — Evidence integrity is not evidence authenticity

Status: unresolved by design and documented.

A matching SHA-256 proves that fetched bytes match the claimant's or insurer's prior commitment. It does not authenticate who published the Netlify document, prove the incident occurred, prove the claimant timestamp, or prove causation. The semantic prompt states this limitation and treats all fetched fields and party statements as untrusted data. This is acceptable for the specified simulated V1 cases but not an oracle for real-world loss.

### Low

#### L-01 — Claimed incident time is an allegation

Status: mitigated/documented.

The contract deterministically requires the claimed time to be within activation and expiration, not in the future, and rejects filing after expiration. It cannot independently establish when a real incident occurred. The timestamp is frozen as claim input and is not presented as independent proof.

## Consensus audit

`adjudicate_claim` snapshots policy conditions, exclusions, agent identifier, claim description/time, insurer response, and both immutable URL/hash commitments before calling nondeterministic execution. The nondeterministic code does not write storage or emit transfers.

The leader and validator both execute `_judgment_proposal(snapshot)`. Each proposal independently:

1. Fetches claimant and insurer evidence with `gl.nondet.web.get`.
2. Requires a bounded 2xx byte response, rejects a changed response URL, verifies raw-byte SHA-256 before decoding, rejects invalid UTF-8, duplicate JSON keys, non-standard JSON constants, non-object roots, and oversized bodies.
3. Deterministically requires claimant evidence `insured_agent` to exactly equal the frozen policy identifier and checks known structured references for invalid or contradictory values. This gate runs before the semantic prompt.
4. Builds a canonical JSON representation and a deterministic SHA-256 digest of the evidence roles and verification statuses, including identity-gate failures.
5. Supplies only verified JSON to the semantic prompt, while labeling all case data as untrusted and rejecting prompt-injection instructions.
6. Evaluates unauthorized action, causal loss, conditions, exclusions, conflicts, and insufficiency with a strictly bounded outcome/reason-code pair.

The validator requires `gl.vm.Return`, parses the leader result, runs its own complete proposal, and compares outcome, reason code, and evidence digest. A malformed leader result, malformed model output, failed evidence fetch, identity mismatch, or disagreement cannot become a `COVERED` result: malformed model output raises an LLM error, unavailable or insufficient claimant evidence becomes `INSUFFICIENT_EVIDENCE`, an explicit agent mismatch becomes `NOT_COVERED`, and a consensus mismatch fails validation. The contract then maps only the bounded consensus result to deterministic accounting.

The evidence digest intentionally binds the ordered claimant/insurer roles and verification statuses. The stored URL/hash commitments bind the exact intended bytes; collision or second-preimage resistance is assumed from SHA-256. Policy terms have no update method and are read from the frozen snapshot during adjudication.

## Lifecycle and financial audit

- Policy creation requires a distinct nonzero insurer and policyholder, a positive fixed amount, a bounded duration, and exact native GEN funding. The reserve is initialized to the compensation amount and the policy activates immediately.
- A policyholder can file immediately after activation. Filing is limited to one claim, validates ownership, incident timing, policy state, URL, and lowercase SHA-256 format, and opens a bounded insurer response window.
- The insurer can submit one counterevidence commitment and must explicitly finalize it for immediate judgment, or waive the opportunity for immediate judgment. Without either action, the policyholder must wait for the response deadline. Silence is never approval and cannot be bypassed.
- `COVERED` moves the fixed amount from reserve to outstanding liability. The AI cannot choose the amount, recipient, deadline, or accounting state.
- `NOT_COVERED` closes judgment without compensation; reserve remains refundable only after expiration.
- `INSUFFICIENT_EVIDENCE` opens a bounded review window with reserve locked. A participant can close the unresolved claim after review; refund remains unavailable until policy expiration.
- Settlement uses the stored policyholder only, requires exactly the stored liability, clears liability, and marks the claim paid before the external transfer. Later settlement calls fail after committed state.
- Refund requires the insurer, expiration, no duplicate refund, no open/ready/review/settlement-pending claim, and zero outstanding liability. It zeroes the reserve before the external transfer.

Within committed contract state, duplicate payout/refund calls, unauthorized recipients, premature refunds, active-claim reserve release, and policyholder/insurer role confusion are rejected. Effects-first ordering limits reentrant-like duplicate execution. The remaining H-01 risk is exclusively the unobservable external transfer/finalization boundary.

## Tests and verification

Host tests include local Netlify fixtures for covered, excluded, insufficient, conflicting, and prompt-injection records; deterministic matching, mismatching, missing, malformed, and contradictory agent identity cases; static storage and API checks; adversarial raw evidence tests; canonical digest checks; independent leader/validator call-count checks; forged covered-result rejection; malformed model-output rejection; claimant fetch failure; lifecycle authorization/deadline/duplicate/refund checks; and settlement idempotence checks.

The new consensus tests use a small host-only SDK stub. They prove the contract helper behavior and validator independence, not genuine GenLayer consensus.

Results for this audit run:

- Python AST parse: passed for contract and test Python files.
- Host/unit tests: passed, 18 passed with third-party pytest plugin autoload disabled because the installed GenLayer plugin requires Python 3.10+ while the available interpreter is Python 3.9.
- `genvm-lint lint contracts/cover.py --json`: passed.
- `genvm-lint check contracts/cover.py --json`: blocked at SDK validation because the pinned runner archive is unavailable; lint portion passed.
- Direct GenLayer VM lifecycle tests: blocked before deployment because the pinned runner hash is unavailable to `gltest`.
- Genuine Studio Next consensus and final GEN transfer failure/retry tests: not run.
- DynArray storage: absent.
- Source byte limit: checked with `wc -c` against the UTF-8 source file.

## Final interface and storage

Views: `get_config`, `get_policy_count`, `get_claim_count`, `get_policy`, `get_claim`.

Writes: `create_policy`, `file_claim`, `submit_insurer_response`, `finalize_insurer_response`, `waive_insurer_response`, `adjudicate_claim`, `close_insufficient_claim`, `settle_claim`, `refund_policy`.

Storage uses scalar counters (`u256`) and typed `gl.storage.TreeMap` fields for policy and claim records. No `DynArray`, Python list, or other unsupported persistent container is used.

## Hash and size record

The pre-remediation contract SHA-256 was `3cdfea839fe2a22354de64197f70e13cf7b6392580a39ed513d1c0c577316f65`. The final post-remediation SHA-256 is `83eae18df28aa965a284deea9a803da01c3d0473efefa1367a0a50d2c2406494`; the final UTF-8 source size is `34432` bytes.
