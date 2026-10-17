# COVER V1 Intelligent Contract

COVER is an escrow-backed AI agent failure insurance court. The insurer funds one fixed compensation amount in native GEN when the policy is created. One designated policyholder may file at most one claim during the policy window. The contract, not the semantic evaluator, selects the recipient, amount, reserve movement, and state transition.

## Deployment

The authoritative source is `contracts/cover.py` and is pinned to the GAVEL Studio Next runner:

```text
py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng
```

The insurer must send exactly `compensation_amount` native GEN to `create_policy`. The policy becomes active immediately with `activation_time = transaction time` and `expiration_time = activation_time + duration_seconds`. V1 rejects policy durations over 366 days and stores no premium or shared pool.

## Public interface

Views:

- `get_config()` — protocol bounds, states, verdicts, and runner pin.
- `get_policy_count()` and `get_claim_count()` — monotonic identifiers.
- `get_policy(policy_id)` — immutable terms, parties, timestamps, reserve, liability, status, and claim link.
- `get_claim(claim_id)` — claim fields, frozen evidence commitments, response state, judgment, review state, and settlement attempts.

Writes:

- `create_policy(policyholder, insured_agent_id, coverage_conditions, exclusions, compensation_amount, duration_seconds)` payable — creates and fully funds an active policy.
- `file_claim(policy_id, incident_description, incident_time, evidence_url, evidence_sha256)` — policyholder-only, one claim, incident time must be within the active policy and not in the future.
- `submit_insurer_response(claim_id, response, counterevidence_url, counterevidence_sha256)` — insurer-only, once, before the response deadline.
- `finalize_insurer_response(claim_id)` — insurer-only explicit finalization; judgment is then immediately eligible.
- `waive_insurer_response(claim_id)` — insurer-only explicit waiver; judgment is then immediately eligible.
- `adjudicate_claim(claim_id)` — policyholder- or insurer-only after finalization, waiver, or the response deadline; neither participant may bypass an open response window.
- `close_insufficient_claim(claim_id)` — insurer or policyholder after the bounded review window; closes an unresolved claim without paying it.
- `settle_claim(claim_id)` — deterministic fixed-amount payout operation for a `COVERED` claim.
- `refund_policy(policy_id)` — insurer-only after expiry and after every claim, judgment, review, and liability obligation has ended.

Evidence URLs must be HTTPS subdomains of `*.netlify.app`, with lowercase 64-character SHA-256 commitments. The runtime accepts only bounded 2xx response bodies, rejects redirects, verifies the raw bytes before UTF-8/JSON parsing, rejects malformed or duplicate-key JSON, and passes only canonical verified JSON to the semantic prompt. A matching hash proves content integrity against the commitment; it does not prove who published the document or that the real-world loss occurred.

The claimant-supplied incident timestamp is a bounded claim input. It is not an independent proof of time, loss, authorization, or causation. V1 uses simulated incident records and does not call agent services, oracles, explorers, or other third-party APIs.

## Lifecycle and accounting

`ACTIVE -> RESPONSE_OPEN -> READY_FOR_JUDGMENT -> SETTLEMENT_PENDING -> PAID` is the covered path. A finalized response or waiver removes unnecessary waiting. If the insurer is silent, the policyholder cannot adjudicate until `response_deadline`; silence is not approval.

`NOT_COVERED` becomes a judged terminal claim with no compensation. Its unused reserve can be refunded only after policy expiry. `INSUFFICIENT_EVIDENCE` becomes `REVIEW_OPEN`; the reserve remains locked through `review_deadline`. A participant may then call `close_insufficient_claim`, after which the reserve is refundable only once the policy has also expired. There is no silent approval or automatic early refund.

For `COVERED`, judgment moves the exact fixed compensation from `reserve_remaining` to `outstanding_liability`. Settlement uses only the stored policyholder address, sets the claim paid and liability to zero before emitting the transfer, and rejects later settlement attempts. There is deliberately no separate retry method: after a final transaction failure, a caller may invoke `settle_claim` again only if the finalized state still proves `SETTLEMENT_PENDING`.

The transfer implementation follows GAVEL’s Studio Next `_Recipient(...).emit_transfer(value=amount)` pattern. `emit_transfer` does not expose a synchronous success/failure result to the contract. Callers must inspect final execution, not merely an accepted transaction. If a failed transfer rolls back the write, the claim remains `SETTLEMENT_PENDING` and `settle_claim` can be invoked again after finalization. If a deployment environment preserves the `PAID` state while asynchronously failing or refunding an emitted transfer, COVER cannot detect or repair that failure inside this contract; the beneficiary may remain unpaid while the liability is cleared. This is an unresolved runner/execution limitation, not a claimed retry guarantee.

## Consensus boundary

`adjudicate_claim` snapshots immutable policy conditions/exclusions, the insured agent identifier, claim data, response text, and both evidence commitments before entering nondeterministic execution. The leader and validator each independently:

1. Fetch the claimant and, when present, insurer Netlify JSON.
2. Bound the HTTP response, reject redirects, verify raw SHA-256, decode UTF-8, reject malformed JSON, and derive an evidence-status digest.
3. Treat every fetched field and party statement as untrusted data.
4. Evaluate unauthorized action, causal covered loss, conditions, and exclusions with the same bounded JSON semantic output.
5. Compare the substantive `outcome`, `reason_code`, and evidence-status digest.

Allowed outcomes are `COVERED`, `NOT_COVERED`, and `INSUFFICIENT_EVIDENCE`. The contract maps no AI output to a user-selected amount or wallet. Malformed model output or disagreement fails the consensus attempt rather than being converted into a payout.

## Tests

The test layout separates host/static checks from GenLayer VM checks:

- `tests/unit/test_cover_static.py` checks the runner pin, byte bound, storage declarations, write surface, effects-before-transfer ordering, and local JSON fixture bounds.
- `tests/direct/test_cover_lifecycle.py` exercises policy funding, authorization, response finalization/waiver/deadline, verdict branches, evidence failures, conflicts, unresolved review, settlement idempotence, and refund guards using local Netlify fixtures.
- `tests/fixtures/` contains the JSON bodies and prompt-injection fixture used by mocked web calls.

Direct-mode tests use host-simulated web/model results. Per the GenLayer testing model, they do not prove production validator agreement. A configured integration/Studio Next run is still required for genuine consensus, final transfer execution, and accepted-versus-finalized failure behavior.
