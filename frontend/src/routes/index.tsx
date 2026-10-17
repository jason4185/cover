import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { SectionHeading, PageContainer } from "@/components/cover/Shell";
import {
  Button,
  ErrorState,
  MetricCard,
  UnconfiguredState,
} from "@/components/cover/UI";
import { useCoverOverview } from "@/hooks/use-cover-data";
import { COVER_CONFIGURED } from "@/lib/genlayer/config";
import { formatGen } from "@/lib/genlayer/format";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  const overview = useCoverOverview();
  const data = overview.data;
  const covered =
    data?.claims.filter((claim) => claim.verdict === "COVERED").length ?? 0;
  const reserved =
    data?.policies.reduce(
      (total, policy) => total + policy.reserveRemaining,
      0n,
    ) ?? 0n;
  return (
    <>
      <section className="hero">
        <div className="hero-grid" />
        <div className="hero-glow" />
        <div className="hero-visual">
          <div className="hero-visual-lines" />
          <div className="hero-visual-core" />
        </div>
        <div className="container hero-content">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-dot" />
              Insurance for autonomous agents
            </p>
            <h1>
              Protection for the <em>autonomous</em> world.
            </h1>
            <p className="hero-text">
              Create funded insurance policies, submit claims for covered AI
              agent failures, and resolve them through GenLayer consensus.
            </p>
            <div className="hero-actions">
              <Button href="/policies" variant="light">
                Explore policies
              </Button>
              <Button href="/create" variant="outline">
                Create policy
              </Button>
            </div>
          </div>
          <div className="hero-index">
            <strong>01 / 06</strong>Policy layer
            <br />
            Evidence court
            <br />
            Deterministic settlement
          </div>
        </div>
      </section>

      <PageContainer>
        <section className="home-section">
          <SectionHeading
            eyebrow="The protocol"
            title="A claims court for autonomous agents."
            description="COVER lets insurers fund policies for specified AI agent failures. Policyholders submit claims, GenLayer evaluates the evidence, and the contract applies the predefined compensation rules."
            action={{ label: "Read the method", to: "/how-it-works" }}
          />
          <div className="process-grid">
            {[
              [
                "01",
                "Create a policy",
                "Define the insured agent, coverage conditions, exclusions, and fixed compensation.",
              ],
              [
                "02",
                "Fund coverage",
                "The insurer deposits the full fixed compensation in native GEN before the policy activates.",
              ],
              [
                "03",
                "File a claim",
                "The designated policyholder can file one claim while the active policy is in force.",
              ],
              [
                "04",
                "Freeze evidence",
                "The claim stores a Netlify HTTPS URL and a SHA-256 commitment to the evidence bytes.",
              ],
              [
                "05",
                "Independent judgment",
                "The leader and validators independently verify and evaluate the submitted evidence.",
              ],
              [
                "06",
                "Settle",
                "The contract determines liability, compensation, settlement, and refund eligibility.",
              ],
            ].map(([number, title, copy]) => (
              <article className="process-step" key={number}>
                <div className="process-number">
                  <span>{number}</span>
                  <span>↗</span>
                </div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section stats-section">
          <SectionHeading
            eyebrow="Live protocol surface"
            title="Only what the contract records."
            description="Metrics below are read from COVER when a contract address is configured. No synthetic activity, balances, or percentages are shown."
          />
          {!COVER_CONFIGURED ? (
            <UnconfiguredState />
          ) : overview.isLoading ? (
            <div className="loading-state">Reading on-chain statistics…</div>
          ) : overview.error ? (
            <ErrorState
              message={overview.error.message}
              retry={() => void overview.refetch()}
            />
          ) : (
            <>
              <div className="stats-grid">
                <MetricCard
                  label="Total policies"
                  value={String(data?.policyCount ?? 0)}
                  detail="Cumulative on-chain count"
                  tone="signal"
                />
                <MetricCard
                  label="Total claims"
                  value={String(data?.claimCount ?? 0)}
                  detail="One claim maximum per policy"
                />
                <MetricCard
                  label="Covered claims scanned"
                  value={String(covered)}
                  detail={
                    data?.scanLimited
                      ? "Bounded scan · partial view"
                      : "From scanned claims"
                  }
                  tone="positive"
                />
                <MetricCard
                  label="Reserve scanned"
                  value={formatGen(reserved)}
                  detail={
                    data?.scanLimited
                      ? "From visible policy records only"
                      : "Current reserve remaining"
                  }
                  tone="warning"
                />
              </div>
              {data?.scanLimited && (
                <p className="scan-note" style={{ marginTop: 14 }}>
                  The contract exposes counts and individual getters, not
                  paginated lists. COVER scans the newest 100 records and labels
                  the view when the count exceeds that bound.
                </p>
              )}
            </>
          )}
        </section>

        <section className="home-section">
          <div className="reason-grid">
            <div className="reason-copy">
              <p className="eyebrow">Why COVER exists</p>
              <h2>Autonomous systems need clear protection.</h2>
              <p>
                AI agents can act across tools, accounts, and protocols. COVER
                gives insurers and policyholders a defined process for reviewing
                a reported failure without giving either party control of the
                judgment or the settlement rules.
              </p>
              <Button href="/create" variant="light">
                Fund a policy
              </Button>
            </div>
            <div className="principle-list">
              {[
                [
                  "01",
                  "Terms before incidents",
                  "Coverage conditions and exclusions are written before a claim and become immutable at activation.",
                ],
                [
                  "02",
                  "Evidence as commitments",
                  "The browser helps prepare references; GenLayer performs the authoritative fetch, hash, and parse checks.",
                ],
                [
                  "03",
                  "AI judgment, contract control",
                  "Consensus selects only a bounded judgment. Amounts, wallets, deadlines, and accounting stay deterministic.",
                ],
                [
                  "04",
                  "No false certainty",
                  "A matching hash protects integrity, not authenticity. Simulated evidence remains a simulated incident record.",
                ],
              ].map(([number, title, copy]) => (
                <article className="principle" key={number}>
                  <span>{number}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="home-section">
          <div className="cta-panel">
            <p className="eyebrow">
              <ShieldCheck size={13} /> COVER / V1
            </p>
            <h2>Give every autonomous action a clear protection boundary.</h2>
            <p>
              Create a policy with a fixed reserve, or inspect the records
              already on-chain.
            </p>
            <div className="inline-actions">
              <Button href="/create" variant="light">
                Create a policy
              </Button>
              <Link className="text-link" to="/claims">
                Browse claims <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      </PageContainer>
    </>
  );
}
