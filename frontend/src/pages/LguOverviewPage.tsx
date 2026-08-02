import { ArrowRight, ClipboardCheck, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getLguOverview } from "../features/lgu/api";
import { LguPageHeader, LguStatus } from "../features/lgu/components";
import { LGU_OVERVIEW } from "../features/lgu/data";
import type { LguOverview } from "../features/lgu/types";

const EMPTY_OVERVIEW: LguOverview = {
  metrics: [
    { value: 0, label: "Pending Job Posts", note: "Awaiting a reviewer", tone: "warning" },
    { value: 0, label: "Employers Need Evidence", note: "Documents or contacts missing", tone: "warning" },
    { value: 0, label: "Approved This Month", note: "Published after review", tone: "success" },
    { value: 0, label: "Returned for Changes", note: "Waiting for the employer" },
  ],
  priorities: [],
  recentActivity: [],
};

function activityTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("reject")) return "danger" as const;
  if (normalized.includes("change") || normalized.includes("return")) {
    return "warning" as const;
  }
  if (
    normalized.includes("approv") ||
    normalized.includes("verif") ||
    normalized.includes("publish")
  ) {
    return "success" as const;
  }
  return "default" as const;
}

function formatTimestamp(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

export function LguOverviewPage() {
  const [overview, setOverview] = useState(
    import.meta.env.MODE === "test" ? LGU_OVERVIEW : EMPTY_OVERVIEW,
  );
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (import.meta.env.MODE === "test") return;
    let active = true;
    getLguOverview()
      .then((result) => {
        if (active) setOverview(result);
      })
      .catch(() => {
        if (active) setLoadError("Verification data could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="page lgu-page">
      <div className="page-container">
        <LguPageHeader
          eyebrow="Angeles City PESO / LGU"
          title="Verification Overview"
          intro="Monitor employer records and job posts that require local review."
          action={
            <Link className="button button--primary" to="/lgu/verification">
              Open Verification Queue <ArrowRight aria-hidden="true" />
            </Link>
          }
        />

        {loadError ? <p className="lgu-load-error" role="alert">{loadError}</p> : null}

        <section className="lgu-metric-grid" aria-label="Verification summary">
          {overview.metrics.map((metric) => (
            <article className={`lgu-metric lgu-metric--${metric.tone ?? "default"}`} key={metric.label}>
              <strong>{metric.value}</strong>
              <h2>{metric.label}</h2>
              <p>{metric.note}</p>
            </article>
          ))}
        </section>

        <div className="lgu-overview-grid">
          <section className="lgu-panel">
            <div className="lgu-panel__heading">
              <div>
                <span className="lgu-kicker">Latest Decisions</span>
                <h2>Recent Verification Activity</h2>
              </div>
              <ClipboardCheck aria-hidden="true" />
            </div>
            <div className="lgu-list">
              {overview.recentActivity.map((activity) => (
                <article className="lgu-list-row" key={activity.id}>
                  <div>
                    <h3>{activity.title}</h3>
                    <p>{activity.detail}</p>
                  </div>
                  <div className="lgu-list-row__meta">
                    <LguStatus
                      tone={activityTone(activity.status)}
                    >
                      {activity.status}
                    </LguStatus>
                    <small>{formatTimestamp(activity.time)}</small>
                  </div>
                </article>
              ))}
              {overview.recentActivity.length === 0 ? (
                <div className="lgu-empty-result"><h3>No decisions recorded</h3><p>Reviewer activity will appear here.</p></div>
              ) : null}
            </div>
          </section>

          <aside className="lgu-panel">
            <div className="lgu-panel__heading">
              <div>
                <span className="lgu-kicker">Reviewer Priorities</span>
                <h2>Needs Attention</h2>
              </div>
              <ShieldAlert aria-hidden="true" />
            </div>
            <div className="lgu-priority-list">
              {overview.priorities.map((priority) => (
                <article className="lgu-priority" key={priority.id}>
                  <LguStatus tone={priority.tone}>{priority.label}</LguStatus>
                  <h3>{priority.title}</h3>
                  <p>{priority.detail}</p>
                </article>
              ))}
              {overview.priorities.length === 0 ? (
                <div className="lgu-empty-result"><h3>Nothing needs attention</h3><p>New priorities will appear here.</p></div>
              ) : null}
            </div>
          </aside>
        </div>

        <div className="lgu-source-note">
          <ShieldAlert aria-hidden="true" />
          <p>Records shown here are submitted by employers and reviewed against PESO / LGU evidence.</p>
          <Link to="/about/data-sources">About Data Sources</Link>
        </div>
      </div>
    </div>
  );
}
