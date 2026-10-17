import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, BriefcaseBusiness, WalletCards } from "lucide-react";
import {
  PageContainer,
  PageIntro,
  SectionHeading,
} from "@/components/cover/Shell";
import { ClaimCard, PolicyCard } from "@/components/cover/Records";
import {
  Button,
  EmptyState,
  ErrorState,
  MetricCard,
  Panel,
  UnconfiguredState,
} from "@/components/cover/UI";
import { useClaimExplorer, usePolicyExplorer } from "@/hooks/use-cover-data";
import { COVER_CONFIGURED } from "@/lib/genlayer/config";
import { formatGen, sameAddress } from "@/lib/genlayer/format";
import { useWallet } from "@/lib/genlayer/wallet";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const wallet = useWallet();
  const policies = usePolicyExplorer();
  const claims = useClaimExplorer();
  if (!COVER_CONFIGURED)
    return (
      <PageContainer>
        <PageIntro
          eyebrow="Wallet dashboard"
          title="Your policies and claims, in one view."
          description="The dashboard filters real on-chain records by the connected wallet. Configure the deployed COVER address to begin."
        />
        <UnconfiguredState />
      </PageContainer>
    );
  if (!wallet.address)
    return (
      <PageContainer>
        <PageIntro
          eyebrow="Wallet dashboard"
          title="See the policies linked to your wallet."
          description="Connect an injected wallet to filter policies where you are the Insurer or Policyholder."
          action={
            <Button variant="light" onClick={() => void wallet.connect()}>
              Connect wallet
            </Button>
          }
        />
        <EmptyState
          icon={<WalletCards size={19} />}
          title="Wallet connection required"
          description="COVER does not use a local copy of your portfolio. The dashboard reads a bounded set of on-chain records and filters them by address."
        />
      </PageContainer>
    );
  if (policies.isLoading || claims.isLoading)
    return (
      <PageContainer>
        <PageIntro
          eyebrow="Wallet dashboard"
          title="Reading your policies and claims."
          description="Fetching the current bounded record set from Studio Next."
        />
        <div className="loading-state">Reading records for this wallet…</div>
      </PageContainer>
    );
  if (policies.error || claims.error)
    return (
      <PageContainer>
        <ErrorState
          message={
            policies.error?.message ??
            claims.error?.message ??
            "Could not read dashboard records."
          }
          retry={() => {
            void policies.refetch();
            void claims.refetch();
          }}
        />
      </PageContainer>
    );
  const minePolicies = (policies.data?.items ?? []).filter(
    (policy) =>
      sameAddress(wallet.address, policy.insurer) ||
      sameAddress(wallet.address, policy.policyholder),
  );
  const policyIds = new Set(minePolicies.map((policy) => policy.id));
  const mineClaims = (claims.data?.items ?? []).filter((claim) =>
    policyIds.has(claim.policyId),
  );
  const insured = minePolicies.filter((policy) =>
    sameAddress(wallet.address, policy.policyholder),
  );
  const issued = minePolicies.filter((policy) =>
    sameAddress(wallet.address, policy.insurer),
  );
  const reserved = issued.reduce(
    (total, policy) => total + policy.reserveRemaining,
    0n,
  );
  return (
    <PageContainer>
      <PageIntro
        eyebrow="Wallet dashboard"
        title="Your COVER position."
        description="A bounded view of policies and claims returned by the contract. Older records may be outside the explorer scan limit."
        action={
          <Button href="/create" variant="light">
            Create policy
          </Button>
        }
      />
      <div className="metric-grid">
        <MetricCard
          label="Linked policies"
          value={String(minePolicies.length)}
          detail={`${issued.length} issued · ${insured.length} held`}
        />
        <MetricCard
          label="Linked claims"
          value={String(mineClaims.length)}
          detail="Linked to visible policies"
        />
        <MetricCard
          label="GEN still reserved"
          value={formatGen(reserved)}
          detail="From policies you insure"
          tone="metric-signal"
        />
        <MetricCard
          label="Wallet"
          value={`${wallet.address.slice(0, 6)}…`}
          detail={wallet.chainId === 61997 ? "Studio Next" : "Switch network"}
        />
      </div>
      <section className="dashboard-section">
        <SectionHeading
          eyebrow="Coverage"
          title="Policies you insure or hold"
          description="Actions are available on the policy record only when your wallet and the contract state permit them."
          action={{ label: "Explore all policies", to: "/policies" }}
        />
        {minePolicies.length ? (
          <div className="record-grid">
            {minePolicies.map((policy) => (
              <PolicyCard key={policy.id} policy={policy} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<BriefcaseBusiness size={19} />}
            title="No linked policies yet"
            description="Create a policy as the Insurer or open a funded policy where your wallet is the Policyholder."
            action={
              <Button href="/create" variant="outline">
                Create first policy
              </Button>
            }
          />
        )}
      </section>
      <section className="dashboard-section">
        <SectionHeading
          eyebrow="Claims"
          title="Claims linked to your policies"
          description="Claim records are read through the contract's global count and individual getters."
          action={{ label: "Explore all claims", to: "/claims" }}
        />
        {mineClaims.length ? (
          <div className="record-grid">
            {mineClaims.map((claim) => (
              <ClaimCard key={claim.id} claim={claim} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No linked claims"
            description="A Policyholder can file one claim while an active policy is within its coverage period."
          />
        )}
      </section>
      <Panel className="dashboard-limit">
        <ArrowUpRight size={17} />
        <span>
          Dashboard filtering is read-only and bounded to the same scan limit as
          the public explorers. It does not use local storage as a source of
          truth.
        </span>
      </Panel>
    </PageContainer>
  );
}
