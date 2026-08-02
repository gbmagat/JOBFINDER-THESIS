import { Download, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getLguAuditLog } from "../features/lgu/api";
import { LguPageHeader, LguStatus } from "../features/lgu/components";
import { LGU_AUDIT_ENTRIES } from "../features/lgu/data";

function formatTimestamp(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function isWithinRange(value: string, range: string) {
  if (range === "all") return true;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return true;
  const days = range === "week" ? 7 : 31;
  return timestamp >= Date.now() - days * 24 * 60 * 60 * 1000;
}

export function LguAuditLogPage() {
  const [entries, setEntries] = useState(
    import.meta.env.MODE === "test" ? LGU_AUDIT_ENTRIES : [],
  );
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("all");
  const [reviewer, setReviewer] = useState("all");
  const [dateRange, setDateRange] = useState("week");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (import.meta.env.MODE === "test") return;
    let active = true;
    getLguAuditLog()
      .then((result) => {
        if (active) setEntries(result.entries);
      })
      .catch(() => {
        if (active) setLoadError("The Audit Log could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesQuery =
        !normalized ||
        `${entry.reviewer} ${entry.action} ${entry.subject}`
          .toLowerCase()
          .includes(normalized);
      const matchesAction = action === "all" || entry.tone === action;
      const matchesReviewer = reviewer === "all" || entry.reviewer === reviewer;
      return (
        matchesQuery &&
        matchesAction &&
        matchesReviewer &&
        isWithinRange(entry.time, dateRange)
      );
    });
  }, [action, dateRange, entries, query, reviewer]);

  const reviewers = Array.from(new Set(entries.map((entry) => entry.reviewer)));
  const today = new Date().toDateString();
  const todayCount = entries.filter((entry) => {
    const timestamp = Date.parse(entry.time);
    return Number.isFinite(timestamp) && new Date(timestamp).toDateString() === today;
  }).length;
  const approvals = entries.filter((entry) => entry.tone === "success").length;
  const changes = entries.filter((entry) => entry.tone === "warning").length;
  const rejections = entries.filter((entry) => entry.tone === "danger").length;

  function exportLog() {
    const rows = [
      ["Time", "Reviewer", "Action", "Subject", "Detail"],
      ...visibleEntries.map((entry) => [
        entry.time,
        entry.reviewer,
        entry.action,
        entry.subject,
        entry.detail,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "jobfinder-lgu-audit-log.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page lgu-page">
      <div className="page-container">
        <LguPageHeader
          eyebrow="Accountability Record"
          title="Audit Log"
          intro="Review the decisions recorded by authorized PESO / LGU reviewers."
          action={<button className="button button--secondary" disabled={visibleEntries.length === 0} onClick={exportLog} type="button"><Download aria-hidden="true" /> Export Log</button>}
        />

        {loadError ? <p className="lgu-load-error" role="alert">{loadError}</p> : null}

        <section className="lgu-metric-grid lgu-metric-grid--four" aria-label="Audit summary">
          <article className="lgu-metric"><strong>{todayCount}</strong><h2>Today</h2><p>Total review actions</p></article>
          <article className="lgu-metric lgu-metric--success"><strong>{approvals}</strong><h2>Approvals</h2><p>Published or verified</p></article>
          <article className="lgu-metric lgu-metric--warning"><strong>{changes}</strong><h2>Changes Requested</h2><p>Returned to employers</p></article>
          <article className="lgu-metric"><strong>{rejections}</strong><h2>Rejections</h2><p>Evidence not accepted</p></article>
        </section>

        <section className="lgu-panel">
          <div className="lgu-toolbar lgu-toolbar--audit">
            <label className="lgu-search-field"><Search aria-hidden="true" /><span className="sr-only">Search audit log</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Search reviewer, action, or record" type="search" value={query} /></label>
            <label className="lgu-sort-field"><span>Action</span><select onChange={(event) => setAction(event.target.value)} value={action}><option value="all">All Actions</option><option value="success">Approvals</option><option value="warning">Changes Requested</option><option value="danger">Rejections</option></select></label>
            <label className="lgu-sort-field"><span>Reviewer</span><select onChange={(event) => setReviewer(event.target.value)} value={reviewer}><option value="all">All Reviewers</option>{reviewers.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label className="lgu-sort-field"><span>Date</span><select onChange={(event) => setDateRange(event.target.value)} value={dateRange}><option value="week">Last 7 Days</option><option value="month">Last 31 Days</option><option value="all">All Dates</option></select></label>
          </div>

          <div className="lgu-audit-list" aria-live="polite">
            {visibleEntries.map((entry) => (
              <article className="lgu-audit-row" key={entry.id}>
                <time>{formatTimestamp(entry.time)}</time>
                <div><h2>{entry.action}</h2><p>{entry.subject}</p><small>{entry.detail}</small></div>
                <span>{entry.reviewer}</span>
                <LguStatus tone={entry.tone}>{entry.tone === "success" ? "Recorded" : entry.tone === "warning" ? "Follow-up" : "Rejected"}</LguStatus>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
