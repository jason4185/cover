import json

from conftest import (
    CLAIM_URL,
    CONTRACT,
    COUNTER_URL,
    DAY,
    GEN,
    NOW,
    NOW_EPOCH,
    mock_fixture,
    mock_judgment,
    warp,
)


def create_policy(direct_vm, contract, insurer, policyholder, value=GEN, duration=7 * DAY):
    direct_vm.sender = insurer
    direct_vm.value = value
    return contract.create_policy(
        policyholder,
        "agent:demo-v1",
        "Cover unauthorized agent actions that directly cause the described loss.",
        "Exclude authorized actions, unrelated losses, and unsupported allegations.",
        GEN,
        duration,
    )


def file_claim(direct_vm, contract, policy_id, policyholder, url=CLAIM_URL, digest=None):
    direct_vm.sender = policyholder
    if digest is None:
        digest = mock_fixture(direct_vm, "claim-covered.json", url)
    return contract.file_claim(policy_id, "The agent made an unauthorized action and caused the loss.", NOW_EPOCH, url, digest)


def test_policy_creation_funding_and_immediate_claim(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    policy_id = create_policy(direct_vm, contract, direct_alice, direct_bob)
    policy = contract.get_policy(policy_id)
    assert policy["insurer"] == direct_alice.as_hex
    assert policy["policyholder"] == direct_bob.as_hex
    assert policy["reserve_remaining"] == GEN
    assert policy["status"] == "ACTIVE"
    claim_id = file_claim(direct_vm, contract, policy_id, direct_bob)
    assert contract.get_claim(claim_id)["status"] == "RESPONSE_OPEN"


def test_insufficient_funding_and_unauthorized_claim_and_duplicate_claim(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender, direct_vm.value = direct_alice, GEN - 1
    with direct_vm.expect_revert("funding must exactly equal"):
        contract.create_policy(direct_bob, "agent", "conditions", "exclusions", GEN, DAY)
    policy_id = create_policy(direct_vm, contract, direct_alice, direct_bob)
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("only the policyholder"):
        contract.file_claim(policy_id, "loss", NOW_EPOCH, CLAIM_URL, "0" * 64)
    claim_id = file_claim(direct_vm, contract, policy_id, direct_bob)
    with direct_vm.expect_revert("policy is not claimable"):
        file_claim(direct_vm, contract, policy_id, direct_bob)
    assert claim_id == 1


def test_response_finalization_makes_judgment_immediately_eligible(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT)
    policy_id = create_policy(direct_vm, contract, direct_alice, direct_bob)
    claim_id = file_claim(direct_vm, contract, policy_id, direct_bob)
    counter_hash = mock_fixture(direct_vm, "counterevidence.json", COUNTER_URL)
    direct_vm.sender = direct_alice
    contract.submit_insurer_response(claim_id, "I deny the allegation.", COUNTER_URL, counter_hash)
    contract.finalize_insurer_response(claim_id)
    mock_fixture(direct_vm, "claim-covered.json", CLAIM_URL)
    mock_fixture(direct_vm, "counterevidence.json", COUNTER_URL)
    mock_judgment(direct_vm, "COVERED", "COVERAGE_ESTABLISHED")
    direct_vm.sender = direct_bob
    assert contract.adjudicate_claim(claim_id) == "COVERED"
    assert contract.get_claim(claim_id)["status"] == "SETTLEMENT_PENDING"


def test_insurer_waiver_allows_immediate_judgment_without_approval(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT)
    policy_id = create_policy(direct_vm, contract, direct_alice, direct_bob)
    claim_id = file_claim(direct_vm, contract, policy_id, direct_bob)
    direct_vm.sender = direct_alice
    contract.waive_insurer_response(claim_id)
    mock_fixture(direct_vm, "claim-excluded.json", CLAIM_URL)
    mock_judgment(direct_vm, "NOT_COVERED", "EXCLUSION_APPLIES")
    direct_vm.sender = direct_bob
    assert contract.adjudicate_claim(claim_id) == "NOT_COVERED"


def test_conflicting_claimant_and_insurer_evidence_returns_bounded_unresolved_verdict(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT)
    policy_id = create_policy(direct_vm, contract, direct_alice, direct_bob)
    claim_id = file_claim(direct_vm, contract, policy_id, direct_bob)
    counter_hash = mock_fixture(direct_vm, "counterevidence.json", COUNTER_URL)
    direct_vm.sender = direct_alice
    contract.submit_insurer_response(claim_id, "The action was authorized.", COUNTER_URL, counter_hash)
    contract.finalize_insurer_response(claim_id)
    mock_fixture(direct_vm, "claim-conflict.json", CLAIM_URL)
    mock_fixture(direct_vm, "counterevidence.json", COUNTER_URL)
    mock_judgment(direct_vm, "INSUFFICIENT_EVIDENCE", "EVIDENCE_CONFLICT")
    direct_vm.sender = direct_bob
    assert contract.adjudicate_claim(claim_id) == "INSUFFICIENT_EVIDENCE"


def test_silence_requires_response_deadline_and_does_not_auto_approve(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT)
    policy_id = create_policy(direct_vm, contract, direct_alice, direct_bob)
    claim_id = file_claim(direct_vm, contract, policy_id, direct_bob)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("response opportunity"):
        contract.adjudicate_claim(claim_id)
    warp(direct_vm, "2026-01-04T00:00:01Z")
    mock_fixture(direct_vm, "claim-insufficient.json", CLAIM_URL)
    mock_judgment(direct_vm, "INSUFFICIENT_EVIDENCE", "INSUFFICIENT_EVIDENCE")
    assert contract.adjudicate_claim(claim_id) == "INSUFFICIENT_EVIDENCE"


def test_insurer_can_advance_an_abandoned_claim_only_after_response_deadline(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT)
    policy_id = create_policy(direct_vm, contract, direct_alice, direct_bob)
    claim_id = file_claim(direct_vm, contract, policy_id, direct_bob)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("open response window"):
        contract.adjudicate_claim(claim_id)
    warp(direct_vm, "2026-01-04T00:00:01Z")
    mock_fixture(direct_vm, "claim-insufficient.json", CLAIM_URL)
    mock_judgment(direct_vm, "INSUFFICIENT_EVIDENCE", "INSUFFICIENT_EVIDENCE")
    assert contract.adjudicate_claim(claim_id) == "INSUFFICIENT_EVIDENCE"


def test_covered_excluded_conflicting_and_malicious_evidence_are_bounded(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT)
    cases = [
        ("claim-covered.json", "COVERED", "COVERAGE_ESTABLISHED"),
        ("claim-excluded.json", "NOT_COVERED", "EXCLUSION_APPLIES"),
        ("claim-conflict.json", "INSUFFICIENT_EVIDENCE", "EVIDENCE_CONFLICT"),
        ("claim-malicious.json", "NOT_COVERED", "UNAUTHORIZED_ACTION_NOT_ESTABLISHED"),
    ]
    for index, (fixture, outcome, reason) in enumerate(cases):
        policy_id = create_policy(direct_vm, contract, direct_alice, direct_bob)
        url = CLAIM_URL.replace("claim-covered", fixture[:-5]) + str(index)
        claim_id = file_claim(direct_vm, contract, policy_id, direct_bob, url=url, digest=mock_fixture(direct_vm, fixture, url))
        direct_vm.sender = direct_alice
        contract.waive_insurer_response(claim_id)
        mock_fixture(direct_vm, fixture, url)
        mock_judgment(direct_vm, outcome, reason)
        direct_vm.sender = direct_bob
        assert contract.adjudicate_claim(claim_id) == outcome


def test_invalid_url_hash_and_altered_evidence_become_safe_insufficient_evidence(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT)
    policy_id = create_policy(direct_vm, contract, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("HTTPS Netlify"):
        contract.file_claim(policy_id, "loss", NOW_EPOCH, "https://evil.example/case.json", "0" * 64)
    with direct_vm.expect_revert("SHA-256"):
        contract.file_claim(policy_id, "loss", NOW_EPOCH, CLAIM_URL, "0" * 63 + "G")
    altered_hash = "0" * 64
    claim_id = file_claim(direct_vm, contract, policy_id, direct_bob, digest=altered_hash)
    direct_vm.sender = direct_alice
    contract.waive_insurer_response(claim_id)
    mock_fixture(direct_vm, "claim-covered.json", CLAIM_URL)
    direct_vm.sender = direct_bob
    assert contract.adjudicate_claim(claim_id) == "INSUFFICIENT_EVIDENCE"


def test_insufficient_evidence_review_is_bounded_before_refund(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT)
    policy_id = create_policy(direct_vm, contract, direct_alice, direct_bob)
    claim_id = file_claim(direct_vm, contract, policy_id, direct_bob)
    direct_vm.sender = direct_alice
    contract.waive_insurer_response(claim_id)
    mock_fixture(direct_vm, "claim-insufficient.json", CLAIM_URL)
    mock_judgment(direct_vm, "INSUFFICIENT_EVIDENCE", "INSUFFICIENT_EVIDENCE")
    direct_vm.sender = direct_bob
    contract.adjudicate_claim(claim_id)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("review window"):
        contract.close_insufficient_claim(claim_id)
    warp(direct_vm, "2026-01-05T00:00:01Z")
    contract.close_insufficient_claim(claim_id)
    with direct_vm.expect_revert("policy has not expired"):
        contract.refund_policy(policy_id)
    warp(direct_vm, "2026-01-09T00:00:01Z")
    assert contract.refund_policy(policy_id) == GEN


def test_covered_settlement_pays_only_stored_policyholder_and_cannot_repeat(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = direct_deploy(CONTRACT)
    policy_id = create_policy(direct_vm, contract, direct_alice, direct_bob)
    claim_id = file_claim(direct_vm, contract, policy_id, direct_bob)
    direct_vm.sender = direct_alice
    contract.waive_insurer_response(claim_id)
    mock_fixture(direct_vm, "claim-covered.json", CLAIM_URL)
    mock_judgment(direct_vm, "COVERED", "COVERAGE_ESTABLISHED")
    direct_vm.sender = direct_bob
    contract.adjudicate_claim(claim_id)
    direct_vm.sender = direct_charlie
    assert contract.settle_claim(claim_id) == "PAID"
    assert contract.get_policy(policy_id)["outstanding_liability"] == 0
    with direct_vm.expect_revert("not awaiting settlement"):
        contract.settle_claim(claim_id)


def test_refund_is_not_available_for_active_or_outstanding_claim(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT)
    policy_id = create_policy(direct_vm, contract, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("has not expired"):
        contract.refund_policy(policy_id)
    claim_id = file_claim(direct_vm, contract, policy_id, direct_bob)
    warp(direct_vm, "2026-01-09T00:00:01Z")
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("outstanding claim obligation"):
        contract.refund_policy(policy_id)
    assert contract.get_claim(claim_id)["status"] == "RESPONSE_OPEN"
