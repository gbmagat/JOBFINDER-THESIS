import {
  ArrowLeft,
  Check,
  FileCheck2,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getLguEmployerReview,
  submitLguEmployerDecision,
} from "../features/lgu/api";
import { LguPageHeader, LguStatus } from "../features/lgu/components";
import type {
  LguDecision,
  LguEmployerReviewResponse,
} from "../features/lgu/types";

function detailText(
  details: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
) {
  const value = details?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readableStatus(status: string) {
  return status
    .split("-")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export function LguEmployerReviewPage() {
  const { employerId = "northpoint-cafe" } = useParams();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [review, setReview] = useState<LguEmployerReviewResponse | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    setLoadError("");
    getLguEmployerReview(employerId)
      .then((result) => {
        if (active) setReview(result);
      })
      .catch(() => {
        if (active) setLoadError("This employer record could not be loaded.");
      });

    return () => {
      active = false;
    };
  }, [employerId]);

  const employer = review?.employer;
  const verificationStatus = employer?.verification.status ?? "pending";
  const companyName = employer?.companyName ?? "Northpoint Café";
  const representative = employer?.displayName ?? "Maria Reyes";
  const phone = detailText(employer?.details, "phone", "Not provided");
  const email = detailText(
    employer?.details,
    "email",
    employer?.email ?? "Not provided",
  );
  const location =
    employer?.address ||
    detailText(employer?.details, "barangay", "Balibago, Angeles City");
  const businessType = detailText(
    employer?.details,
    "industry",
    "Not specified",
  );

  const fallbackChecklist = [
    { id: "business-registration", label: "Business Record", status: "complete" },
    { id: "business-contact", label: "Business Contact", status: "confirmed" },
    { id: "workplace-address", label: "Workplace Address", status: "confirmed" },
  ];
  const checklist = review?.checklist.length
    ? review.checklist
    : fallbackChecklist;

  async function saveDecision(decision: LguDecision) {
    if (!review) return;

    setIsSubmitting(true);
    setMessage("");
    try {
      const result = await submitLguEmployerDecision(employerId, {
        decision,
        note,
      });
      setReview((current) =>
        current
          ? {
              ...current,
              employer: {
                ...current.employer,
                verification: {
                  ...current.employer.verification,
                  status: result.status as typeof current.employer.verification.status,
                },
              },
            }
          : current,
      );
      setMessage(
        decision === "approve"
          ? "Employer verified successfully."
          : decision === "request-changes"
            ? "Evidence requested from the employer."
            : "Employer record rejected and added to the Audit Log.",
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
          <Link className="lgu-back-link" to="/lgu/employers">
            <ArrowLeft aria-hidden="true" /> Back to Employer Records
          </Link>
          <LguPageHeader
            eyebrow="Employer Verification"
            title={
              loadError ? "Employer Record Unavailable" : "Loading Employer Record"
            }
            intro={loadError || "Retrieving the organization and its evidence."}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page lgu-page">
      <div className="page-container">
        <Link className="lgu-back-link" to="/lgu/employers">
          <ArrowLeft aria-hidden="true" /> Back to Employer Records
        </Link>
        <LguPageHeader
          eyebrow="Employer Verification"
          title="Review Employer Record"
          intro={`${companyName} · Representative ${representative}`}
          action={
            <LguStatus
              tone={verificationStatus === "verified" ? "success" : "warning"}
            >
              {verificationStatus === "pending"
                ? "Pending Final Check"
                : readableStatus(verificationStatus)}
            </LguStatus>
          }
        />

        <section
          className="lgu-summary-strip"
          aria-label="Employer evidence summary"
        >
          {checklist.map((item, index) => {
            const Icon = index === 1 ? Phone : index === 2 ? MapPin : ShieldCheck;
            return (
              <article key={item.id}>
                <Icon aria-hidden="true" />
                <div>
                  <strong>{item.label}</strong>
                  <span>{readableStatus(item.status)}</span>
                </div>
              </article>
            );
          })}
        </section>

        <div className="lgu-review-layout">
          <div className="lgu-review-content">
            <section className="lgu-panel">
              <div className="lgu-panel__heading">
                <div>
                  <span className="lgu-kicker">Organization Details</span>
                  <h2>{companyName}</h2>
                </div>
                <ShieldCheck aria-hidden="true" />
              </div>
              <dl className="lgu-detail-grid">
                <div>
                  <dt>Business Type</dt>
                  <dd>{businessType}</dd>
                </div>
                <div>
                  <dt>Representative</dt>
                  <dd>{representative}</dd>
                </div>
                <div>
                  <dt>Official Contact</dt>
                  <dd>{phone}</dd>
                  <dd>{email}</dd>
                </div>
                <div>
                  <dt>Workplace</dt>
                  <dd>{location}</dd>
                </div>
              </dl>
            </section>

            <section className="lgu-panel">
              <div className="lgu-panel__heading">
                <div>
                  <span className="lgu-kicker">Submitted Evidence</span>
                  <h2>Documents and Contacts</h2>
                </div>
                <FileCheck2 aria-hidden="true" />
              </div>
              <div className="lgu-evidence-grid">
                {checklist.map((item, index) => {
                  const complete =
                    item.status === "complete" || item.status === "confirmed";
                  const Icon = index === 1 ? Phone : index === 2 ? MapPin : FileCheck2;
                  return (
                    <article key={item.id}>
                      <Icon aria-hidden="true" />
                      <div>
                        <strong>{item.label}</strong>
                        <p>
                          {complete
                            ? "Submitted information is complete."
                            : "Evidence is missing or needs confirmation."}
                        </p>
                      </div>
                      <LguStatus tone={complete ? "success" : "warning"}>
                        {complete ? "Complete" : "Needs Evidence"}
                      </LguStatus>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="lgu-panel lgu-decision-panel">
            <span className="lgu-kicker">Decision Panel</span>
            <h2>Final Employer Check</h2>
            <ul className="lgu-checklist">
              {[
                "DTI or LGU permit",
                "Business contact",
                "Workplace address and map pin",
                "Consistent submitted data",
              ].map((item) => (
                <li key={item}>
                  <Check aria-hidden="true" /> {item}
                </li>
              ))}
            </ul>
            <label className="lgu-field">
              <span>Reviewer Note</span>
              <textarea
                onChange={(event) => setNote(event.target.value)}
                placeholder="Explain any requested evidence or rejection."
                rows={5}
                value={note}
              />
            </label>
            <div className="lgu-decision-actions">
              <button
                className="button button--primary"
                disabled={isSubmitting}
                onClick={() => saveDecision("approve")}
                type="button"
              >
                Verify Employer
              </button>
              <button
                className="button button--secondary"
                disabled={isSubmitting}
                onClick={() => saveDecision("request-changes")}
                type="button"
              >
                Request Evidence
              </button>
              <button
                className="button button--danger"
                disabled={isSubmitting}
                onClick={() => saveDecision("reject")}
                type="button"
              >
                Reject Record
              </button>
            </div>
            {message ? (
              <p className="lgu-decision-message" role="status">
                {message}
              </p>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
