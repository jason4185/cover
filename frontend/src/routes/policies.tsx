import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageContainer, PageIntro } from "@/components/cover/Shell";
import { PolicyCard } from "@/components/cover/Records";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  UnconfiguredState,
} from "@/components/cover/UI";
import { usePolicyExplorer } from "@/hooks/use-cover-data";
import { COVER_CONFIGURED } from "@/lib/genlayer/config";
import { formatStatus } from "@/lib/genlayer/format";
import type { PolicyStatus } from "@/lib/genlayer/types";

export const Route = createFileRoute("/policies")({ component: PoliciesPage });

function PoliciesPage() {
  const query = usePolicyExplorer();
  const [filter, setFilter] = useState<"ALL" | PolicyStatus>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 9;
  const filtered = useMemo(
    () =>
      (query.data?.items ?? []).filter((policy) => {
        const matchesStatus = filter === "ALL" || policy.status === filter;
        const term = search.trim().toLowerCase();
        return (
          matchesStatus &&
          (!term ||
            policy.id === term ||
            policy.insuredAgentId.toLowerCase().includes(term) ||
            policy.insurer.toLowerCase().includes(term) ||
            policy.policyholder.toLowerCase().includes(term))
        );
      }),
    [filter, query.data?.items, search],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);
  return (
    <PageContainer>
      <PageIntro
        eyebrow="Public policy explorer"
        title="Funded protection, recorded on-chain."
        description="Browse policies created and fully funded by insurers on COVER. Each record comes from the contract's count and individual policy getters."
        action={
          <div className="inline-actions">
            <a className="text-link" href="#records">
              Browse records
            </a>
          </div>
        }
      />
      <section className="content-section" id="records">
        {!COVER_CONFIGURED ? (
          <UnconfiguredState />
        ) : query.isLoading ? (
          <LoadingState label="Reading policies" />
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
                  ["ALL", "ACTIVE", "REVIEW", "RESOLVED", "REFUNDED"] as const
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
                    {item === "ALL" ? "All states" : formatStatus(item)}
                  </button>
                ))}
              </div>
              <input
                className="search-input"
                placeholder="Search by ID, agent, or wallet"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
                aria-label="Search policies"
              />
            </div>
            {query.data?.limited && (
              <p className="scan-note">
                Showing the newest 100 policies because COVER exposes a bounded
                individual-getter scan.
              </p>
            )}
            {visible.length === 0 ? (
              <EmptyState
                title="No policies match"
                description="No visible policy matches this filter. If the contract has no records, this is an honest empty state."
              />
            ) : (
              <div className="record-grid">
                {visible.map((policy) => (
                  <PolicyCard key={policy.id} policy={policy} />
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
