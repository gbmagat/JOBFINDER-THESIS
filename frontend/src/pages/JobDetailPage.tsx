import { useState } from "react";
import {
  ArchiveX,
  ArrowLeft,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  MapPin,
  Navigation,
  WalletCards,
} from "lucide-react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { SignInDialog } from "../features/auth/SignInDialog";
import { useAuth } from "../features/auth/AuthContext";
import { getJobById } from "../features/jobs/data";
import { MatchBreakdown } from "../features/jobs/MatchBreakdown";
import {
  DEFAULT_SAVED_JOB_IDS,
  SAVED_JOB_IDS_KEY,
} from "../features/jobs/saved-jobs";
import { SourceProvenance } from "../features/jobs/SourceProvenance";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import { usePersistentState } from "../lib/usePersistentState";
import { userStorageKey } from "../lib/storage-keys";

const currency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export function JobDetailPage() {
  const { jobId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const job = getJobById(jobId);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const [signInOpen, setSignInOpen] = useState(false);
  const [savedJobIds, setSavedJobIds] = usePersistentState<string[]>(
    userStorageKey(SAVED_JOB_IDS_KEY, user?.id),
    DEFAULT_SAVED_JOB_IDS,
  );
  const isJobSeeker = user?.role === "job-seeker";
  const isEmployer = user?.role === "employer";
  const saved = job ? savedJobIds.includes(job.id) : false;
  const isExpired =
    searchParams.get("state") === "expired" ||
    Boolean(
      job?.closingAt && Date.parse(job.closingAt) < Date.now(),
    );

  if (!job) {
    return (
      <section className="empty-state">
        <h1>This job is no longer available</h1>
        <p>Browse the latest public listings to find another opportunity.</p>
        <Link className="button button--primary" to="/jobs">
          Back to search
        </Link>
      </section>
    );
  }

  if (isExpired) {
    return (
      <div className="page job-detail-page">
        <Link className="back-link" to="/jobs">
          <ArrowLeft size={18} aria-hidden="true" /> Back to search
        </Link>
        <section className="status-state status-state--expired" role="status">
          <ArchiveX size={32} aria-hidden="true" />
          <p className="kicker">Listing snapshot</p>
          <h1>This job is no longer accepting applications</h1>
          <p>
            {job.title} at {job.employerName} has expired or was removed. Its
            previous match explanation remains available for transparency.
          </p>
          <div className="cluster">
            <Link className="button button--primary" to="/jobs">
              Find similar open jobs
            </Link>
            <Link
              className="button button--secondary"
              to={`/jobs?q=${encodeURIComponent(job.title)}`}
            >
              Search this role
            </Link>
          </div>
        </section>
        <MatchBreakdown compact match={job.fit} />
        <SourceProvenance compact source={job.source} />
      </div>
    );
  }

  const sourceText =
    job.source.origin === "direct-employer"
      ? "Direct employer post"
      : `${job.source.organizationType.toUpperCase()} dataset`;

  function handleApply() {
    if (!isOnline) {
      return;
    }

    if (isJobSeeker) {
      navigate(`/jobs/${job!.id}/apply`);
      return;
    }
    if (isEmployer) {
      return;
    }
    setSignInOpen(true);
  }

  function handleSave() {
    if (!user) {
      navigate(
        `/sign-in?${new URLSearchParams({
          returnTo: `/jobs/${job!.id}`,
        }).toString()}`,
      );
      return;
    }
    if (!isJobSeeker) {
      return;
    }
    setSavedJobIds((current) =>
      current.includes(job!.id)
        ? current.filter((id) => id !== job!.id)
        : [...current, job!.id],
    );
  }

  return (
    <div className="page job-detail-page">
      <Link className="back-link" to="/jobs">
        <ArrowLeft size={18} aria-hidden="true" /> Back to search
      </Link>

      <header className="job-hero">
        <div className="job-hero__main">
          <div className="job-hero__topline">
            <span className="source-pill">{sourceText}</span>
            <span className="match-badge">{job.fit.overallScore}% match</span>
          </div>
          <h1>{job.title}</h1>
          <p className="job-hero__employer">
            {job.employerName} · {job.location.barangay},{" "}
            {job.location.city}
          </p>
          <div className="job-fact-row">
            <span>
              <BriefcaseBusiness size={17} aria-hidden="true" />
              {job.employmentType} · {job.workArrangement}
            </span>
            <span>
              <WalletCards size={17} aria-hidden="true" />
              {currency.format(job.salary.minimumPhp)}–
              {currency.format(job.salary.maximumPhp)} / {job.salary.period}
            </span>
            <span>
              <CalendarDays size={17} aria-hidden="true" />
              Posted{" "}
              {new Intl.DateTimeFormat("en-PH", {
                month: "short",
                day: "numeric",
              }).format(new Date(job.postedAt))}
            </span>
          </div>
        </div>
        <button
          aria-pressed={saved}
          className="button button--secondary"
          disabled={isEmployer}
          onClick={handleSave}
          type="button"
        >
          <Bookmark
            fill={saved ? "currentColor" : "none"}
            size={18}
            aria-hidden="true"
          />
          {saved
            ? "Saved"
            : isEmployer
              ? "Job seeker feature"
              : isJobSeeker
                ? "Save job"
                : "Save · Sign in"}
        </button>
      </header>

      <div className="job-detail-layout">
        <div className="job-detail-main">
          <MatchBreakdown match={job.fit} />

          <section className="content-card route-summary-card">
            <div className="card-heading-row">
              <span className="icon-tile icon-tile--soft">
                <Navigation size={22} aria-hidden="true" />
              </span>
              <div>
                <p className="kicker">Shortest route to work</p>
                <h2>
                  {job.route.distanceKm.toFixed(1)} km · Estimated{" "}
                  {job.route.estimatedMinutes} min
                </h2>
              </div>
            </div>
            <p>{job.route.textSummary}</p>
            <div className="route-stats">
              <span>
                <Clock3 size={17} aria-hidden="true" />
                {job.route.estimatedMinutes} minutes
              </span>
              <span>
                <MapPin size={17} aria-hidden="true" />
                {job.location.venue}
              </span>
            </div>
            <Link className="button button--secondary" to="route">
              View route details
            </Link>
          </section>

          <section className="content-card" aria-labelledby="about-role-heading">
            <p className="kicker">About the role</p>
            <h2 id="about-role-heading">{job.title}</h2>
            <p>{job.description}</p>

            <h3>What you will do</h3>
            <ul className="detail-list">
              {job.requirements.responsibilities.map((item) => (
                <li key={item}>
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <h3>Role requirements</h3>
            <div className="requirement-grid">
              <div>
                <GraduationCap size={20} aria-hidden="true" />
                <span>
                  <strong>Education</strong>
                  {job.requirements.education}
                </span>
              </div>
              <div>
                <BriefcaseBusiness size={20} aria-hidden="true" />
                <span>
                  <strong>Experience</strong>
                  {job.requirements.experience}
                </span>
              </div>
            </div>
            <div className="chip-row">
              {job.requirements.requiredSkills.map((skill) => (
                <span className="chip" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
          </section>

          <SourceProvenance source={job.source} />

          <section className="content-card employer-card">
            <span className="icon-tile icon-tile--soft">
              <Building2 size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="kicker">Employer</p>
              <h2>{job.employerName}</h2>
              <p>
                This overview is attached to the listing source. Review the
                source details above before sharing personal information.
              </p>
            </div>
          </section>
        </div>

        <aside className="apply-panel">
          <div className="apply-panel__card">
            <p className="kicker">Ready to apply?</p>
            <h2>
              {isEmployer
                ? "Previewing this public job as an employer."
                : "Browse freely. Sign in only to submit."}
            </h2>
            <div className="apply-route">
              <Navigation size={19} aria-hidden="true" />
              <span>
                <strong>{job.route.estimatedMinutes} min commute</strong>
                {job.route.distanceKm.toFixed(1)} km to{" "}
                {job.location.barangay}
              </span>
            </div>
            <div className="access-note">
              <CheckCircle2 size={19} aria-hidden="true" />
              <span>
                <strong>Application access</strong>
                Sign in is required only at this step. We&apos;ll return you to
                this job and continue the correct application method.
              </span>
            </div>
            {!isOnline ? (
              <div className="notice notice--warning" role="status">
                <span>
                  <strong>You are offline.</strong> Reconnect before signing in
                  or continuing this application. Nothing will be queued.
                </span>
              </div>
            ) : null}
            <button
              className="button button--primary button--block"
              disabled={isEmployer || !isOnline}
              onClick={handleApply}
              type="button"
            >
              {isEmployer
                ? "Job seeker account required"
                : `Apply now${isJobSeeker ? "" : " · Sign in required"}`}
            </button>
            <Link className="button button--secondary button--block" to="route">
              View public route
            </Link>
            <p className="apply-panel__footnote">
              Browsing stays public. Application submission is protected.
            </p>
          </div>
        </aside>
      </div>

      <div className="mobile-apply-bar">
        <div>
          <strong>{job.fit.overallScore}% match</strong>
          <span>{job.route.estimatedMinutes} min commute</span>
        </div>
        <button
          className="button button--primary"
          disabled={isEmployer || !isOnline}
          onClick={handleApply}
          type="button"
        >
          {isEmployer
            ? "Job seeker only"
            : isOnline
              ? "Apply now"
              : "Reconnect to apply"}
        </button>
      </div>

      <SignInDialog
        jobId={job.id}
        jobTitle={`${job.title} at ${job.employerName}`}
        onClose={() => setSignInOpen(false)}
        open={signInOpen}
      />
    </div>
  );
}
