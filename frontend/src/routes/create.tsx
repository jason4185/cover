import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { Check, ShieldPlus } from "lucide-react";
import { PageContainer, PageIntro } from "@/components/cover/Shell";
import { TransactionModal } from "@/components/cover/TransactionModal";
import {
  Button,
  ErrorState,
  InfoRow,
  Panel,
  UnconfiguredState,
} from "@/components/cover/UI";
import { useCoverRefresh } from "@/hooks/use-cover-data";
import { readPolicies } from "@/lib/genlayer/reads";
import { readUntilAcceptedState } from "@/lib/genlayer/accepted";
import { COVER_CONFIGURED } from "@/lib/genlayer/config";
import {
  isHexAddress,
  formatGen,
  parseGenAmount,
  sameAddress,
} from "@/lib/genlayer/format";
import { createPolicyWrite } from "@/lib/genlayer/writes";
import { useWallet } from "@/lib/genlayer/wallet";
import type { CoverWrite } from "@/lib/genlayer/types";

export const Route = createFileRoute("/create")({
  component: CreatePolicyPage,
});

type TransactionState = {
  tx: CoverWrite;
  title: string;
  description: string;
  review: ReactNode;
  userValue: bigint;
};

function CreatePolicyPage() {
  const wallet = useWallet();
  const refresh = useCoverRefresh();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState<TransactionState>();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [previousPolicyIds, setPreviousPolicyIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    policyholder: "",
    agent: "",
    conditions: "",
    exclusions: "",
    compensation: "",
    duration: "",
  });

  if (!COVER_CONFIGURED)
    return (
      <PageContainer>
        <PageIntro
          eyebrow="Create policy"
          title="A contract address is required."
          description="This form uses the deployed COVER contract, but it stays disabled until a contract address is configured."
        />
        <UnconfiguredState />
      </PageContainer>
    );

  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    if (!isHexAddress(form.policyholder))
      return setError("Enter a valid 20-byte policyholder address.");
    if (!wallet.address)
      return setError("Connect the insurer wallet before reviewing a policy.");
    if (sameAddress(wallet.address, form.policyholder))
      return setError(
        "The contract requires insurer and policyholder to be different wallets.",
      );
    if (!form.agent.trim() || form.agent.length > 256)
      return setError("Add an insured agent identifier under 256 characters.");
    if (!form.conditions.trim() || form.conditions.length > 4000)
      return setError("Add coverage conditions under 4,000 characters.");
    if (form.exclusions.length > 4000)
      return setError("Keep exclusions under 4,000 characters.");
    let compensation: bigint;
    try {
      compensation = parseGenAmount(form.compensation);
    } catch (cause) {
      return setError(
        cause instanceof Error ? cause.message : "Enter a valid GEN amount.",
      );
    }
    if (compensation <= 0n)
      return setError("Compensation must be greater than zero.");
    const days = Number(form.duration);
    if (!Number.isInteger(days) || days < 1 || days > 366)
      return setError(
        "Coverage duration must be a whole number from 1 to 366 days.",
      );
    setPreparing(true);
    try {
      const request = createPolicyWrite(
        form.policyholder,
        form.agent.trim(),
        form.conditions.trim(),
        form.exclusions.trim(),
        compensation,
        BigInt(days) * 86_400n,
      );
      const previous = await readPolicies();
      setPreviousPolicyIds(previous.items.map((policy) => policy.id));
      setTransaction({
        tx: request.tx,
        userValue: request.userValue ?? compensation,
        title: "Review policy funding",
        description:
          "The insurer funds the fixed compensation in the same transaction. Terms become immutable when the policy activates.",
        review: (
          <div className="review-stack">
            <div className="review-item">
              <span>Policyholder</span>
              <strong className="mono">{form.policyholder}</strong>
            </div>
            <div className="review-item">
              <span>Fixed compensation</span>
              <strong>{formatGen(compensation)}</strong>
            </div>
            <div className="review-item">
              <span>Coverage duration</span>
              <strong>
                {days} {days === 1 ? "day" : "days"}
              </strong>
            </div>
            <div className="review-item">
              <span>Funding</span>
              <strong>Exactly the compensation amount · native GEN</strong>
            </div>
          </div>
        ),
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The policy transaction could not be prepared.",
      );
    } finally {
      setPreparing(false);
    }
  };

  const synchronizeAcceptedState = async () => {
    if (!transaction || !wallet.address) {
      return {
        confirmed: false,
        message:
          "The transaction was accepted, but the new policy could not be identified for synchronization.",
        continueHref: "/policies",
      };
    }
    const result = await readUntilAcceptedState(readPolicies, (current) =>
      current.items.some(
        (policy) =>
          !previousPolicyIds.includes(policy.id) &&
          sameAddress(policy.insurer, wallet.address) &&
          sameAddress(policy.policyholder, form.policyholder) &&
          policy.insuredAgentId === form.agent.trim() &&
          policy.coverageConditions === form.conditions.trim() &&
          policy.exclusions === form.exclusions.trim() &&
          policy.compensation === transaction.userValue &&
          policy.status === "ACTIVE",
      ),
    );
    await refresh();
    const created = result.value?.items.find(
      (policy) =>
        !previousPolicyIds.includes(policy.id) &&
        sameAddress(policy.insurer, wallet.address) &&
        sameAddress(policy.policyholder, form.policyholder) &&
        policy.insuredAgentId === form.agent.trim() &&
        policy.coverageConditions === form.conditions.trim() &&
        policy.exclusions === form.exclusions.trim() &&
        policy.compensation === transaction.userValue &&
        policy.status === "ACTIVE",
    );
    return {
      confirmed: result.confirmed && created !== undefined,
      message:
        result.confirmed && created
          ? "Policy accepted and visible in the policy explorer. Opening the policy record."
          : "Policy accepted, but its new record is not visible yet. Open Policies to resynchronize before retrying.",
      continueHref: "/policies",
      ...(created ? { next: { to: "policy" as const, id: created.id } } : {}),
    };
  };

  const afterSuccess = async (result: {
    next?: { to: "policy" | "policies"; id?: string };
  }) => {
    setTransaction(undefined);
    setSuccess(true);
    await refresh();
    if (result.next?.to === "policy" && result.next.id) {
      await navigate({ to: "/policy/$id", params: { id: result.next.id } });
    } else {
      await navigate({ to: "/policies" });
    }
  };

  return (
    <PageContainer>
      <PageIntro
        eyebrow="New policy"
        title="Protect a specified autonomous agent."
        description="COVER V1 creates one funded policy with one Insurer, one Policyholder, immutable terms, and a fixed GEN compensation amount."
        action={
          <span className="protocol-note">
            <ShieldPlus size={16} /> Full compensation required
          </span>
        }
      />
      {success && (
        <div className="unconfigured success-banner">
          <Check size={17} />
          <span>Policy creation accepted. Opening the policy record…</span>
        </div>
      )}
      <div className="create-layout">
        <form className="panel create-form" onSubmit={submit}>
          <div className="panel-head">
            <div>
              <h2>Policy terms</h2>
              <p>
                Every field below is sent to <code>create_policy</code>. There
                are no hidden defaults.
              </p>
            </div>
            <span className="step-label">01 / 02</span>
          </div>
          <div className="form-grid" style={{ marginTop: 24 }}>
            <div className="form-field full">
              <label htmlFor="policyholder">Policyholder wallet</label>
              <input
                id="policyholder"
                value={form.policyholder}
                onChange={(event) => update("policyholder", event.target.value)}
                placeholder="0x…"
                autoComplete="off"
              />
              <small>
                The stored Policyholder receives any covered compensation.
              </small>
            </div>
            <div className="form-field full">
              <label htmlFor="insured-agent">Insured agent identifier</label>
              <input
                id="insured-agent"
                value={form.agent}
                onChange={(event) => update("agent", event.target.value)}
                placeholder="agent-prod-01"
              />
            </div>
            <div className="form-field full">
              <label htmlFor="conditions">Coverage conditions</label>
              <textarea
                id="conditions"
                value={form.conditions}
                onChange={(event) => update("conditions", event.target.value)}
                placeholder="Describe the unauthorized action and covered loss conditions."
              />
            </div>
            <div className="form-field full">
              <label htmlFor="exclusions">Exclusions</label>
              <textarea
                id="exclusions"
                value={form.exclusions}
                onChange={(event) => update("exclusions", event.target.value)}
                placeholder="Describe events that are not covered. Enter none if there are no exclusions."
              />
            </div>
            <div className="form-field">
              <label htmlFor="compensation">Compensation amount</label>
              <div className="input-suffix">
                <input
                  id="compensation"
                  inputMode="decimal"
                  value={form.compensation}
                  onChange={(event) =>
                    update("compensation", event.target.value)
                  }
                  placeholder="0.00"
                />
                <span>GEN</span>
              </div>
              <small>
                The Insurer must fund this exact amount before activation.
              </small>
            </div>
            <div className="form-field">
              <label htmlFor="duration">Coverage duration</label>
              <div className="input-suffix">
                <input
                  id="duration"
                  inputMode="numeric"
                  value={form.duration}
                  onChange={(event) => update("duration", event.target.value)}
                  placeholder="30"
                />
                <span>days</span>
              </div>
              <small>V1 permits 1–366 days.</small>
            </div>
            {error && <p className="field-error full">{error}</p>}
            <div className="form-actions full">
              <Button type="submit" variant="light" disabled={preparing}>
                {preparing ? "Reading current policy state…" : "Review funding"}
              </Button>
            </div>
          </div>
        </form>
        <aside className="create-aside">
          <Panel>
            <p className="eyebrow">Funding rule</p>
            <h2>The compensation is fixed.</h2>
            <p>
              The contract stores the full compensation as the policy reserve
              when the policy is created. GenLayer never chooses the amount, the
              Policyholder, or the accounting state.
            </p>
            <div className="aside-list">
              <InfoRow label="Token" value="Native GEN" />
              <InfoRow
                label="Settlement recipient"
                value="Stored Policyholder"
              />
              <InfoRow label="Claims per policy" value="One" />
              <InfoRow label="Terms" value="Immutable after activation" />
            </div>
          </Panel>
          <Panel>
            <p className="eyebrow">Before signing</p>
            <ul className="check-list">
              <li>
                <Check size={15} /> Confirm the policyholder address.
              </li>
              <li>
                <Check size={15} /> Read conditions and exclusions together.
              </li>
              <li>
                <Check size={15} /> Fund the full fixed compensation.
              </li>
            </ul>
          </Panel>
        </aside>
      </div>
      {transaction && (
        <TransactionModal
          open
          title={transaction.title}
          description={transaction.description}
          tx={transaction.tx}
          userValue={transaction.userValue}
          review={transaction.review}
          onClose={() => setTransaction(undefined)}
          onAccepted={synchronizeAcceptedState}
          onSuccess={(_status, result) => void afterSuccess(result)}
        />
      )}
    </PageContainer>
  );
}
