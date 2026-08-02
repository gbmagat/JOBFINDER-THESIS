import {
  ArrowLeft,
  Building2,
  Check,
  FileText,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getLguJobReview, submitLguJobDecision } from "../features/lgu/api";
import { LguPageHeader, LguStatus } from "../features/lgu/components";
import type {
  LguDecision,
  LguJobReviewResponse,
} from "../features/lgu/types";

const checks = [
  "Job title and description are clear",
  "Pay and work arrangement are stated",
  "Employer record is verifiable",
  "Workplace address is consistent",
];

function textFrom(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}

function listFrom(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readableLabel(value: string | undefined) {
  if (!value) return "Employer Evidence";
  return value
    .split("-")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function formatSalary(salary: Record<string, unknown> | undefined) {
  const minimum = Number(salary?.minimumPhp ?? salary?.minimum);
  const maximum = Number(salary?.maximumPhp ?? salary?.maximum);
  const pesos = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  });

  if (Number.isFinite(minimum) && Number.isFinite(maximum)) {
    return `${pesos.format(minimum)}–${pesos.format(maximum)}`;
  }
  if (Number.isFinite(minimum)) return `From ${pesos.format(minimum)}`;
  return "Not stated";
}

export function LguJobReviewPage() {
  const { jobId = "service-crew-northpoint" } = useParams();
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<LguDecision | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [review, setReview] = useState<LguJobReviewResponse | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    setLoadError("");
    getLguJobReview(jobId)
      .then((result) => {
        if (active) setReview(result);
      })
      .catch(() => {
        if (active) setLoadError("This job review could not be loaded.");
      });

    return () => {
      active = false;
    };
  }, [jobId]);

  const job = review?.job;
  const employerName =
    review?.employer?.companyName || job?.employerName || "Northpoint Café";
  const barangay = textFrom(job?.location, "barangay");
  const city = textFrom(job?.location, "city");
  const location =
    [barangay, city].filter(Boolean).join(", ") ||
    "Balibago, Angeles City";
  const skills = listFrom(job?.requirements, "requiredSkills");
  const evidence = review?.evidence ?? [];
  const reviewStatus = review?.status ?? job?.reviewStatus ?? "pending";
  const canDecide = reviewStatus === "pending";

  async function saveDecision(nextDecision: LguDecision) {
    if (!review || !canDecide) return;

    setDecision(nextDecision);
    setMessage("");
    setIsSubmitting(true);
    try {
      const result = await submitLguJobDecision(jobId, {
        decision: nextDecision,
        note,
      });
      setReview((current) =>
        current ? { ...current, status: result.status } : current,
      );
      setMessage(
        nextDecision === "approve"
          ? "Job post approved and ready to publish."
          : nextDecision === "request-changes"
            ? "Changes requested from the employer."
            : "Job post rejected and recorded in the Audit Log.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The decision could not be saved. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!review) {
    return (
      <div className="page lgu-page">
        <div className="page-container">
          <Link className="lgu-back-link" to="/lgu/verification">
            <ArrowLeft aria-hidden="true" /> Back to Verification Queue
          </Link>
          <LguPageHeader
            eyebrow="Job Post Review"
            title={loadError ? "Job Review Unavailable" : "Loading Job Review"}
            intro={
              loadError || "Retrieving the employer submission and evidence."
            }
          />
        </div>
      </div>
    );
  }

  const evidenceItems = evidence.length
    ? evidence
    : [
        {
          type: "employer-evidence",
          status: "missing",
          detail: "No evidence was submitted.",
        },
      ];

  return (
    <div className="page lgu-page">
      <div className="page-container">
        <Link className="lgu-back-link" to="/lgu/verification">
          <ArrowLeft aria-hidden="true" /> Back to Verification Queue
        </Link>
        <LguPageHeader
          eyebrow="Job Post Review"
          title={job?.title ?? "Service Crew"}
          intro={`${employerName} · ${location}`}
          action={
            <LguStatus
              tone={reviewStatus === "approved" ? "success" : "warning"}
            >
              {reviewStatus === "pending"
                ? "Pending Review"
                : readableLabel(reviewStatus)}
            </LguStatus>
          }
        />

        <div className="lgu-review-layout">
          <div className="lgu-review-content">
            <section className="lgu-panel">
              <div className="lgu-panel__heading">
                <div>
                  <span className="lgu-kicker">Submitted Listing</span>
                  <h2>Job Details</h2>
                </div>
                <FileText aria-hidden="true" />
              </div>
              <dl className="lgu-detail-grid">
                <div>
                  <dt>Employment Type</dt>
                  <dd>{job?.employmentType ?? "Full-time"}</dd>
                </div>
                <div>
                  <dt>Monthly Pay</dt>
                  <dd>{formatSalary(job?.salary)}</dd>
                </div>
                <div>
                  <dt>Openings</dt>
                  <dd>
                    {job?.openingCount ?? 3} position
                    {(job?.openingCount ?? 3) === 1 ? "" : "s"}
                  </dd>
                </div>
                <div>
                  <dt>Work Setup</dt>
                  <dd>{job?.workArrangement ?? "On-site"}</dd>
                </div>
              </dl>
              <div className="lgu-copy-block">
                <h3>Role Description</h3>
                <p>
                  {job?.description ||
                    job?.summary ||
                    "Assist customers, prepare orders, maintain the service area, and work with the café team during scheduled shifts."}
                </p>
              </div>
              <div className="lgu-copy-block">
                <h3>Required Skills</h3>
                <div className="lgu-chip-row">
                  {(skills.length
                    ? skills
                    : ["Customer Service", "Food Safety", "Communication"]
                  ).map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
                </div>
              </div>
            </section>

            <section className="lgu-panel">
              <div className="lgu-panel__heading">
                <div>
                  <span className="lgu-kicker">Employer Evidence</span>
                  <h2>{employerName}</h2>
                </div>
                <Building2 aria-hidden="true" />
              </div>
              <div className="lgu-evidence-grid">
                {evidenceItems.map((item, index) => {
                  const complete =
                    item.status === "complete" || item.status === "confirmed";
                  const Icon = index === 1 ? MapPin : ShieldCheck;
                  return (
                    <article key={`${item.type ?? "evidence"}-${index}`}>
                      <Icon aria-hidden="true" />
                      <div>
                        <strong>{item.label || readableLabel(item.type)}</strong>
                        <p>{item.detail || "Submitted employer evidence."}</p>
                      </div>
                      <LguStatus tone={complete ? "success" : "warning"}>
                        {complete ? readableLabel(item.status) : "Needs Review"}
                      </LguStatus>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="lgu-panel lgu-decision-panel">
            <span className="lgu-kicker">Reviewer Checklist</span>
            <h2>Verification Decision</h2>
            <ul className="lgu-checklist">
              {checks.map((check) => (
                <li key={check}>
                  <Check aria-hidden="true" /> {check}
                </li>
              ))}
            </ul>
            <label className="lgu-field">
              <span>Reviewer Note</span>
              <textarea
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add a clear reason when requesting changes or rejecting."
                rows={5}
                value={note}
              />
            </label>
            <div className="lgu-decision-actions">
              <button
                className="button button--primary"
                disabled={isSubmitting || !canDecide}
                onClick={() => saveDecision("approve")}
                type="button"
              >
                Approve Job Post
              </button>
              <button
                className="button button--secondary"
                disabled={isSubmitting || !canDecide}
                onClick={() => saveDecision("request-changes")}
                type="button"
              >
                Request Changes
              </button>
              <button
                className="button button--danger"
                disabled={isSubmitting || !canDecide}
                onClick={() => saveDecision("reject")}
                type="button"
              >
                Reject
              </button>
            </div>
            {message ? (
              <p
                className={`lgu-decision-message${
                  decision === "reject" ? " is-danger" : ""
                }`}
                role="status"
              >
                {message}
              </p>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
