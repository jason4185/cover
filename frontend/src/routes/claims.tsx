import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageContainer, PageIntro } from "@/components/cover/Shell";
import { ClaimCard } from "@/components/cover/Records";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  UnconfiguredState,
} from "@/components/cover/UI";
import { useClaimExplorer } from "@/hooks/use-cover-data";
import { COVER_CONFIGURED } from "@/lib/genlayer/config";
import { formatStatus } from "@/lib/genlayer/format";
import type { ClaimStatus, Verdict } from "@/lib/genlayer/types";

export const Route = createFileRoute("/claims")({ component: ClaimsPage });

function ClaimsPage() {
  const query = useClaimExplorer();
  const [filter, setFilter] = useState<"ALL" | ClaimStatus | Verdict>("ALL");
  const [page, setPage] = useState(0);
  const pageSize = 9;
  const filtered = useMemo(
    () =>
      (query.data?.items ?? []).filter(
        (claim) =>
          filter === "ALL" ||
          claim.status === filter ||
          claim.verdict === filter,
      ),
    [filter, query.data?.items],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);
  return (
    <PageContainer>
      <PageIntro
        eyebrow="Public claims archive"
        title="Claims, from filing to settlement."
        description="Each claim records a simulated incident, its evidence commitments, the insurer's response, the GenLayer judgment, and the contract's settlement state."
        action={
          <div className="scan-note">COVER V1 · one claim per policy</div>
        }
      />
      <section className="content-section">
        {!COVER_CONFIGURED ? (
          <UnconfiguredState />
        ) : query.isLoading ? (
          <LoadingState label="Reading claims" />
        ) : query.error ? (
          <ErrorState
            message={query.error.message}
            retry={() => void query.refetch()}
          />
        ) : (
          <>
            <div className="explorer-toolbar">
              <div className="filter-row">
                {(
                  [
                    "ALL",
                    "RESPONSE_OPEN",
                    "READY_FOR_JUDGMENT",
                    "SETTLEMENT_PENDING",
                    "REVIEW_OPEN",
                    "JUDGED",
                    "CLOSED",
                    "COVERED",
                    "NOT_COVERED",
                    "INSUFFICIENT_EVIDENCE",
                    "PAID",
                  ] as const
                ).map((item) => (
                  <button
                    className={`filter-button ${filter === item ? "active" : ""}`}
                    key={item}
                    type="button"
                    onClick={() => {
                      setFilter(item);
                      setPage(0);
                    }}
                  >
                    {item === "ALL" ? "All records" : formatStatus(item)}
                  </button>
                ))}
              </div>
            </div>
            {query.data?.limited && (
              <p className="scan-note">
                Showing the newest 100 claims because COVER exposes a bounded
                individual-getter scan.
              </p>
            )}
            {visible.length === 0 ? (
              <EmptyState
                title="No claims yet"
                description="Claims appear here after a policyholder files a claim against an active policy."
              />
            ) : (
              <div className="record-grid">
                {visible.map((claim) => (
                  <ClaimCard key={claim.id} claim={claim} />
                ))}
              </div>
            )}
            {filtered.length > pageSize && (
              <div className="pagination">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((current) => current - 1)}
                >
                  ← Previous
                </button>
                <span>
                  {page + 1} / {pages}
                </span>
                <button
                  type="button"
                  disabled={page + 1 >= pages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </PageContainer>
  );
}
