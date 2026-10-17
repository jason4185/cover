# COVER

COVER is a GenLayer insurance claims court for AI agent failures. Insurers create and fully fund policies, policyholders submit claims, and independent GenLayer consensus evaluates the submitted evidence against the policy terms. The contract then applies fixed compensation and deterministic GEN settlement rules.

## What COVER does

Each policy names:

- an insurer;
- one policyholder;
- one insured AI agent identifier;
- natural-language coverage conditions and exclusions;
- a fixed compensation amount in GEN; and
- an activation period.

The insurer funds the full compensation amount before the policy becomes active. The policyholder can file one claim during the active period. The evidence must use an HTTPS Netlify URL and a SHA-256 commitment over the exact JSON response bytes.

Netlify fixtures are simulated case records for testing. They help demonstrate evidence integrity and deterministic handling, but they do not authenticate that a real-world incident occurred.

## Claim lifecycle

1. The insurer creates and funds a policy.
2. The policyholder files a claim with an incident description, incident time, Netlify evidence URL, and raw-byte SHA-256 commitment.
3. The insurer submits counterevidence or waives the response opportunity.
4. GenLayer independently fetches and verifies the evidence, checks that the evidence identifies the policy's insured agent, and evaluates authorization, causation, coverage, exclusions, and conflicts.
5. The contract records `COVERED`, `NOT_COVERED`, or `INSUFFICIENT_EVIDENCE`.
6. A separate deterministic settlement operation pays the stored policyholder when compensation is due. Unused reserves become refundable only when policy, claim, judgment, and review obligations have ended.

The insured-agent identity check is deterministic: a mismatched, missing, invalid, or contradictory agent identity cannot receive a `COVERED` result. AI consensus does not choose the payout amount, recipient, or accounting changes.

## GenLayer consensus and settlement

The leader and validators independently retrieve the committed Netlify evidence, validate bounded HTTPS responses, verify raw SHA-256 hashes, parse JSON safely, and perform substantive semantic evaluation. Validators do not merely compare the leader's output format.

Financial state changes remain outside nondeterministic execution. The contract controls the fixed compensation, policyholder beneficiary, reserves, liabilities, claim states, settlement, and refunds. Accepted transactions can update the application's accepted-state view before finalization, but accepted status is not proof that an external GEN transfer has completed.

## Verified V2 test

The current Studio Next deployment has been exercised with a funded 1 GEN policy. A claim was submitted using Netlify evidence, the insurer waived its response, GenLayer returned `COVERED`, and deterministic settlement completed. The policyholder confirmed receiving 1 GEN.

This documents the verified positive path only. It does not claim that every negative, transfer-failure, or validator-runtime scenario was live-tested.

## Smart contract architecture

The authoritative contract is [`contracts/cover.py`](contracts/cover.py). It uses scalar storage and `TreeMap` records without `DynArray` storage. The pinned GenVM runner is:

```text
py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng
```

The contract exposes policy creation, claim filing, insurer response and waiver operations, adjudication, insufficient-evidence closure, settlement, refunds, and configuration/policy/claim reads. See [`docs/COVER_CONTRACT.md`](docs/COVER_CONTRACT.md) for the interface and lifecycle, and [`docs/COVER_AUDIT.md`](docs/COVER_AUDIT.md) for security findings and limitations.

## Frontend

The frontend is a React, TypeScript, TanStack Start/Router, Vite, Tailwind CSS, and Bun application. It provides the landing page, policy and claim explorers, policy and claim detail pages, insurer and policyholder workflows, wallet connection, transaction review, accepted-state refreshes, and automatic Netlify evidence verification.

## Studio Next deployment

The frontend is configured for the deployed COVER V2 contract:

```text
Contract: 0x12EbF0972C27266231e7f0b1c8cc6A20efCC44Fa
Network:  GenLayer Studio Next
Chain ID: 61997
RPC:      https://studio-next.genlayer.com/api
```

The V2 address is public configuration. Do not commit `frontend/.env`; use `frontend/.env.example` as the safe template. Wallet private keys, secrets, and access tokens are never required by this repository.

## Local development

Requirements: Python 3, Bun, and the GenLayer tooling when contract linting is needed.

```bash
# Frontend
cd frontend
bun install
bun run dev
```

The frontend reads `frontend/.env`. Vite environment changes require restarting the development server.

## Testing and verification

From the project root:

```bash
# Contract checks
python3 -B -c 'import ast; ast.parse(open("contracts/cover.py", encoding="utf-8").read())'
pytest tests/unit -q
pytest tests/direct -q
genvm-lint check contracts/cover.py

# Frontend checks
cd frontend
bun run typecheck
bun run lint
bun run test
bun run build
```

Direct GenLayer tests require the matching GenLayer test plugin. If it is unavailable, those tests are reported as blocked or skipped rather than treated as genuine consensus-runtime verification.

## Known limitations

- Netlify evidence is untrusted simulated input; integrity of the fetched bytes is not authenticity of the underlying incident.
- Browser evidence checks can be affected by CORS, so the frontend uses its server-side fetch path where available. The contract independently verifies evidence during consensus.
- Studio Next accepted-state visibility is useful for continuing normal workflows, but finalization and external GEN transfer confirmation remain distinct.
- The repository does not claim that COVER is a licensed insurance company or a production-ready insurance product.
