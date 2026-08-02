import { ArrowRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getLguOverview,
  getLguVerificationQueue,
} from "../features/lgu/api";
import { LguPageHeader, LguStatus } from "../features/lgu/components";
import type { LguVerificationItem } from "../features/lgu/types";

type QueueFilter = "all" | "evidence" | "risk";

function formatTimestamp(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

export function LguVerificationQueuePage() {
  const [items, setItems] = useState<LguVerificationItem[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [sort, setSort] = useState<"oldest" | "newest">("oldest");
  const [approvedThisMonth, setApprovedThisMonth] = useState(0);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    getLguVerificationQueue()
      .then((result) => {
        if (active) setItems(result.items);
      })
      .catch(() => {
        if (active) setLoadError("The verification queue could not be loaded.");
      });
    getLguOverview()
      .then((result) => {
        if (!active) return;
        const approved = result.metrics.find(
          (metric) => metric.label === "Approved This Month",
        );
        setApprovedThisMonth(approved?.value ?? 0);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        `${item.jobTitle} ${item.employer} ${item.location}`
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesFilter =
        filter === "all" ||
        (filter === "evidence" && item.evidenceTone === "warning") ||
        (filter === "risk" && item.riskLevel === "high");
      return matchesQuery && matchesFilter;
    }).sort((left, right) => {
      const leftTime = Date.parse(left.submitted);
      const rightTime = Date.parse(right.submitted);
      const difference =
        (Number.isFinite(leftTime) ? leftTime : 0) -
        (Number.isFinite(rightTime) ? rightTime : 0);
      return sort === "oldest" ? difference : -difference;
    });
  }, [filter, items, query, sort]);

  const evidenceCount = items.filter(
    (item) => item.evidenceTone === "warning",
  ).length;

  return (
    <div className="page lgu-page">
      <div className="page-container">
        <LguPageHeader
          eyebrow="Verification Queue"
          title="Job Post Verification"
          intro="Review employer submissions before the job becomes visible to job seekers."
          action={
            items.length > 0 ? (
              <Link className="button button--primary" to={`/lgu/verification/jobs/${items[0].id}`}>
                Review Next <ArrowRight aria-hidden="true" />
              </Link>
            ) : (
              <button className="button button--primary" disabled type="button">
                Review Next <ArrowRight aria-hidden="true" />
              </button>
            )
          }
        />

        {loadError ? <p className="lgu-load-error" role="alert">{loadError}</p> : null}

        <section className="lgu-metric-grid lgu-metric-grid--three" aria-label="Queue summary">
          <article className="lgu-metric lgu-metric--warning"><strong>{items.length}</strong><h2>Pending Review</h2><p>Awaiting a reviewer</p></article>
          <article className="lgu-metric lgu-metric--warning"><strong>{evidenceCount}</strong><h2>Need Evidence</h2><p>Employer action required</p></article>
          <article className="lgu-metric lgu-metric--success"><strong>{approvedThisMonth}</strong><h2>Approved This Month</h2><p>Published after review</p></article>
        </section>

        <section className="lgu-panel lgu-queue-panel">
          <div className="lgu-panel__heading">
            <div><span className="lgu-kicker">Local Submissions</span><h2>Listings Awaiting Verification</h2></div>
            <LguStatus tone="warning">{items.length} Pending</LguStatus>
          </div>

          <div className="lgu-toolbar">
            <label className="lgu-search-field">
              <Search aria-hidden="true" />
              <span className="sr-only">Search verification queue</span>
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search job, employer, or barangay"
                type="search"
                value={query}
              />
            </label>
            <div className="lgu-filter-group" aria-label="Queue filters">
              {([
                ["all", "All"],
                ["evidence", "Needs Evidence"],
                ["risk", "High Risk"],
              ] as const).map(([value, label]) => (
                <button
                  aria-pressed={filter === value}
                  className={filter === value ? "is-active" : ""}
                  key={value}
                  onClick={() => setFilter(value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="lgu-sort-field">
              <span>Sort</span>
              <select onChange={(event) => setSort(event.target.value as "oldest" | "newest")} value={sort}><option value="oldest">Oldest First</option><option value="newest">Newest First</option></select>
            </label>
          </div>

          <div className="lgu-queue-list" aria-live="polite">
            {visibleItems.map((item) => (
              <article className="lgu-queue-row" key={item.id}>
                <div className="lgu-queue-row__main">
                  <span className="lgu-kicker">Submitted Job Post</span>
                  <h3>{item.jobTitle}</h3>
                  <p>{item.employer} · {item.location}</p>
                </div>
                <div className="lgu-queue-row__evidence">
                  <LguStatus tone={item.evidenceTone}>{item.evidence}</LguStatus>
                  <p>{item.risk}</p>
                </div>
                <small>{formatTimestamp(item.submitted)}</small>
                <Link className="button button--secondary" to={`/lgu/verification/jobs/${item.id}`}>
                  Open Review <ArrowRight aria-hidden="true" />
                </Link>
              </article>
            ))}
            {visibleItems.length === 0 ? (
              <div className="lgu-empty-result"><h3>No matching submissions</h3><p>Try a different job, employer, barangay, or filter.</p></div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
