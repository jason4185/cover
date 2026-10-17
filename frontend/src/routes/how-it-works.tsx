import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Scale,
  ShieldCheck,
  Timer,
} from "lucide-react";
import {
  PageContainer,
  PageIntro,
  SectionHeading,
} from "@/components/cover/Shell";
import { Button, Panel, StatusPill } from "@/components/cover/UI";
import {
  STUDIO_NEXT_CHAIN_ID,
  STUDIO_NEXT_RUNNER,
} from "@/lib/genlayer/config";

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorksPage,
});

const steps = [
  [
    "01",
    "Create a policy",
    "The Insurer defines immutable conditions, exclusions, a designated Policyholder, and a fixed compensation amount.",
  ],
  [
    "02",
    "Fund coverage",
    "The Insurer deposits the full compensation in native GEN. Activation and reserve accounting remain deterministic.",
  ],
  [
    "03",
    "File one claim",
    "The Policyholder can file immediately while the policy is active, with an incident description, claimed time, Netlify URL, and raw-byte hash.",
  ],
  [
    "04",
    "Open the response",
    "The Insurer submits counterevidence or waives. Finalizing the response makes the claim immediately eligible for judgment.",
  ],
  [
    "05",
    "Reach consensus",
    "The leader and validators independently fetch, verify, parse, and semantically evaluate both evidence commitments against the policy terms.",
  ],
  [
    "06",
    "Settle deterministically",
    "The contract maps only a bounded judgment to a fixed compensation entitlement, then requests settlement to the stored Policyholder.",
  ],
] as const;

function HowItWorksPage() {
  return (
    <PageContainer>
      <PageIntro
        eyebrow="The COVER court"
        title="Evidence is evaluated. Rules control settlement."
        description="COVER separates the judgment from the financial action: GenLayer evaluates untrusted evidence against immutable terms, while the contract controls every amount, wallet, and state transition."
        action={
          <Button href="/policies" variant="light">
            Explore policies
          </Button>
        }
      />
      <section className="process-section">
        <SectionHeading
          eyebrow="Lifecycle"
          title="Six steps from policy to resolution"
          description="V1 does not include premiums, shared pools, external oracles, or live agent integrations."
        />
        <div className="lifecycle-grid">
          {steps.map(([number, title, description], index) => (
            <div className="lifecycle-step" key={number}>
              <span className="step-number">{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              {index < steps.length - 1 && (
                <ArrowDown className="step-arrow" size={17} />
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="split-section">
        <Panel className="dark-feature">
          <div className="feature-icon">
            <Scale size={20} />
          </div>
          <p className="eyebrow">Consensus boundary</p>
          <h2>Independent judgment, bounded output.</h2>
          <p>
            Validators do not merely echo the leader. Each validator
            independently retrieves the committed Netlify evidence, checks its
            raw SHA-256 digest, parses bounded JSON, and evaluates coverage,
            exclusions, authorization, and causal loss before checking
            equivalence.
          </p>
          <div className="tag-row">
            <StatusPill status="COVERED" />
            <StatusPill status="NOT_COVERED" />
            <StatusPill status="INSUFFICIENT_EVIDENCE" />
          </div>
        </Panel>
        <Panel>
          <div className="feature-icon">
            <ShieldCheck size={20} />
          </div>
          <p className="eyebrow">Deterministic settlement</p>
          <h2>Judgment never sets the payment.</h2>
          <p>
            The contract owns the compensation amount, the stored Policyholder,
            reserves, liabilities, duplicate prevention, and refund eligibility.
            A COVERED judgment records the entitlement; a separate call requests
            settlement.
          </p>
          <Link className="text-link" to="/claims">
            Inspect claim states <ArrowUpRight size={15} />
          </Link>
        </Panel>
      </section>
      <section className="protocol-section">
        <SectionHeading
          eyebrow="Protocol facts"
          title="A small surface area, explicit limits"
        />
        <div className="protocol-grid">
          <div>
            <Timer size={18} />
            <strong>Immediate claim filing</strong>
            <p>
              Policyholders do not wait for expiration. The Insurer has a
              bounded response window instead.
            </p>
          </div>
          <div>
            <Check size={18} />
            <strong>Netlify-only V1 evidence</strong>
            <p>
              HTTPS Netlify JSON is fetched as untrusted input. A matching hash
              confirms byte integrity but does not authenticate the incident.
            </p>
          </div>
          <div>
            <span className="protocol-number">{STUDIO_NEXT_CHAIN_ID}</span>
            <strong>Studio Next</strong>
            <p>
              Frontend reads and writes target Studio Next when the deployed
              COVER address is configured.
            </p>
          </div>
          <div>
            <span className="protocol-number">
              {STUDIO_NEXT_RUNNER.slice(-8)}
            </span>
            <strong>Pinned runner</strong>
            <p>
              Consensus semantics are bound to the contract's exact runner pin.
            </p>
          </div>
        </div>
      </section>
      <section className="final-cta">
        <p className="eyebrow">
          Autonomous systems need accountable boundaries.
        </p>
        <h2>Make the coverage terms clear.</h2>
        <p>
          Browse the live record set or create a fully funded policy on Studio
          Next.
        </p>
        <div className="inline-actions">
          <Button href="/policies" variant="light">
            Browse policies
          </Button>
          <Button href="/create" variant="outline">
            Create policy
          </Button>
        </div>
      </section>
    </PageContainer>
  );
}
