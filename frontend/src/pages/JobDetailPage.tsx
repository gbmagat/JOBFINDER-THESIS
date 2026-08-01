import { useEffect, useState } from "react";
import {
  ArchiveX,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  Navigation,
} from "lucide-react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { SignInDialog } from "../features/auth/SignInDialog";
import { useAuth } from "../features/auth/AuthContext";
import { useJobs } from "../features/jobs/JobsContext";
import { MatchBreakdown } from "../features/jobs/MatchBreakdown";
import {
  DEFAULT_SAVED_JOB_IDS,
  SAVED_JOB_IDS_KEY,
} from "../features/jobs/saved-jobs";
import { SourceProvenance } from "../features/jobs/SourceProvenance";
import type {
  JobSource,
  MatchExplanation,
} from "../features/jobs/types";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import { usePersistentState } from "../lib/usePersistentState";
import { userStorageKey } from "../lib/storage-keys";
import { apiRequest } from "../lib/api";

const currency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function MatchSummary({
  compact = false,
  match,
}: {
  compact?: boolean;
  match: MatchExplanation;
}) {
  return (
    <section className="content-card">
      <div className="card-heading-row">
        <span className="icon-tile icon-tile--soft">
          <CheckCircle2 size={22} aria-hidden="true" />
        </span>
        <div>
          <p className="kicker">Why this job matches</p>
          <h2>{match.overallScore}% Overall Match</h2>
        </div>
      </div>
      <p>{match.summary}</p>
      <details className="candidate-evidence button--block">
        <summary>
          <span>See Match Details</span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className="surface__body">
          <MatchBreakdown compact={compact} match={match} />
        </div>
      </details>
    </section>
  );
}

function SourceSummary({
  compact = false,
  source,
}: {
  compact?: boolean;
  source: JobSource;
}) {
  const isImported = source.origin === "peso-lgu-dataset";

  return (
    <section className="content-card">
      <div className="card-heading-row">
        <span className="icon-tile icon-tile--soft">
          <Building2 size={22} aria-hidden="true" />
        </span>
        <div>
          <p className="kicker">Job source</p>
          <h2>
            {isImported
              ? `From ${source.organizationName}`
              : `Posted by ${source.organizationName}`}
          </h2>
        </div>
      </div>
      <p>
        {isImported
          ? "This listing came from a PESO/LGU dataset. Confirm that the vacancy and application instructions are still current."
          : "The employer submitted this listing directly to JobFinder. Review the source details before sharing personal information."}
      </p>
      <details className="candidate-evidence button--block">
        <summary>
          <span>See Source and Application Details</span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className="surface__body">
          <SourceProvenance compact={compact} source={source} />
        </div>
      </details>
    </section>
  );
}

export function JobDetailPage() {
  const { jobId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const {
    getJob,
    hasPersonalizedMatches,
    isLoading,
    loadJob,
  } = useJobs();
  const job = getJob(jobId);
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
  const canShowPersonalizedMatch =
    isJobSeeker && hasPersonalizedMatches;
  const saved =
    isJobSeeker && job ? savedJobIds.includes(job.id) : false;
  const isExpired =
    searchParams.get("state") === "expired" ||
    Boolean(
      job?.closingAt && Date.parse(job.closingAt) < Date.now(),
    );

  useEffect(() => {
    if (!isJobSeeker || import.meta.env.MODE === "test") return;

    let active = true;
    apiRequest<{ jobs: { id: string }[] }>("/saved-jobs")
      .then(({ jobs }) => {
        if (active) setSavedJobIds(jobs.map((savedJob) => savedJob.id));
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [isJobSeeker, setSavedJobIds, user?.id]);

  useEffect(() => {
    if (!job && !isLoading && jobId) void loadJob(jobId);
  }, [isLoading, job, jobId, loadJob]);

  if (!job && isLoading) {
    return (
      <section className="status-state" aria-live="polite">
        <h1>Loading Job Details</h1>
        <p>Checking the latest listing information.</p>
      </section>
    );
  }

  if (!job) {
    return (
      <section className="empty-state">
        <h1>This Job Is No Longer Available</h1>
        <p>Browse the latest public listings to find another opportunity.</p>
        <Link className="button button--primary" to="/jobs">
          Back to Job Results
        </Link>
      </section>
    );
  }

  if (isExpired) {
    return (
      <div className="page job-detail-page">
        <Link className="back-link" to="/jobs">
          <ArrowLeft size={18} aria-hidden="true" /> Back to Job Results
        </Link>
        <section className="status-state status-state--expired" role="status">
          <ArchiveX size={32} aria-hidden="true" />
          <p className="kicker">Listing snapshot</p>
          <h1>Applications Are Closed</h1>
          <p>
            {job.title} at {job.employerName} is no longer open.
            {canShowPersonalizedMatch
              ? " Your saved match details remain available below."
              : " Sign in to compare skills on other open jobs."}
          </p>
          <div className="cluster">
            <Link className="button button--primary" to="/jobs">
              View Similar Jobs
            </Link>
            <Link
              className="button button--secondary"
              to={`/jobs?q=${encodeURIComponent(job.title)}`}
            >
              Search This Role
            </Link>
          </div>
        </section>
        {canShowPersonalizedMatch ? <MatchSummary compact match={job.fit} /> : null}
        <SourceSummary compact source={job.source} />
      </div>
    );
  }

  const sourceText =
    job.source.origin === "direct-employer"
      ? "Posted by employer"
      : `${job.source.organizationType.toUpperCase()} dataset`;
  const sourceUpdatedText = new Intl.DateTimeFormat("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(
    new Date(job.source.publishedAt ?? job.postedAt),
  );
  const displayedResponsibilities = job.requirements.responsibilities.slice(0, 3);
  const displayedSkills = job.requirements.requiredSkills.slice(0, 3);

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

  async function handleSave() {
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

    const wasSaved = saved;
    setSavedJobIds((current) =>
      current.includes(job!.id)
        ? current.filter((id) => id !== job!.id)
        : [...current, job!.id],
    );

    if (import.meta.env.MODE === "test") return;

    try {
      await apiRequest(`/saved-jobs/${job!.id}`, {
        method: wasSaved ? "DELETE" : "POST",
      });
    } catch {
      setSavedJobIds((current) =>
        wasSaved
          ? current.includes(job!.id)
            ? current
            : [...current, job!.id]
          : current.filter((id) => id !== job!.id),
      );
    }
  }

  return (
    <div className="page job-detail-page">
      <Link className="back-link" to="/jobs">
        <ArrowLeft size={18} aria-hidden="true" /> Back to Job Results
      </Link>

      <div className="job-detail-layout">
        <div className="job-detail-main">
          <header className="job-hero">
            <div className="job-hero__main">
              <p className="kicker">{sourceText}</p>
              <h1>{job.title}</h1>
              <p className="job-hero__employer">
                {job.employerName} · {job.location.barangay},{" "}
                {job.location.city}
              </p>
              <div className="job-fact-row">
                <span>{job.employmentType}</span>
                <span>{job.workArrangement}</span>
                <span>
                  {currency.format(job.salary.minimumPhp)}–
                  {currency.format(job.salary.maximumPhp)}
                </span>
                <span>{job.route.estimatedMinutes} min estimated travel</span>
              </div>
            </div>
          </header>

          <Link
            aria-label={`View the estimated ${job.route.estimatedMinutes}-minute travel route`}
            className="button button--secondary job-route-action"
            to="route"
          >
            <Navigation size={18} aria-hidden="true" />
            View Travel Details
          </Link>

          {canShowPersonalizedMatch ? (
            <section className="job-match-overview">
              <p className="kicker">Why this job matches</p>
              <h2>{job.fit.overallScore}% Overall Match</h2>
              <div className="job-match-metrics">
                <div>
                  <span>Skill match</span>
                  <strong>{job.fit.skillScore}%</strong>
                </div>
                <div>
                  <span>Estimated travel</span>
                  <strong>{job.route.estimatedMinutes} min</strong>
                </div>
              </div>
              <p>See the simple reasons below before deciding.</p>
            </section>
          ) : null}

          <section
            className="job-detail-section"
            aria-labelledby="responsibilities-heading"
          >
            <h2 id="responsibilities-heading">What You Will Do</h2>
            <ul>
              {displayedResponsibilities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section
            className="job-detail-section"
            aria-labelledby="skills-heading"
          >
            <h2 id="skills-heading">Skills the Employer Is Looking For</h2>
            <div className="chip-row">
              {displayedSkills.map((skill) => (
                <span className="chip" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
          </section>

          <section className="job-source-simple">
            <strong>Job source</strong>
            <p>
              {job.source.origin === "direct-employer"
                ? `Posted directly by ${job.source.organizationName.replace(
                    " Solutions",
                    "",
                  )}`
                : `Provided by ${job.source.organizationName}`}{" "}
              · Updated {sourceUpdatedText}
            </p>
          </section>
        </div>

        <aside className="apply-panel">
          <div className="apply-panel__card">
            <h2>Ready to Apply?</h2>
            <div className="apply-panel__intro">
              <p>You can keep browsing without an account.</p>
              <p>
                {isEmployer
                  ? "Use a job seeker account when you want to apply."
                  : isJobSeeker
                    ? "Your account is ready when you want to apply."
                    : "Sign in only when you want to apply."}
              </p>
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
                ? "Job Seeker Account Required"
                : isJobSeeker
                  ? "Apply Now"
                  : "Sign In to Apply"}
            </button>
            <button
              aria-pressed={saved}
              className="button button--secondary button--block"
              disabled={isEmployer}
              onClick={handleSave}
              type="button"
            >
              {saved
                ? "Saved"
                : isEmployer
                  ? "Job Seeker Feature"
                  : "Save for Later"}
            </button>
            <div className="apply-panel__next">
              <h3>What Happens Next</h3>
              <ol>
                <li>Sign in or create an account.</li>
                <li>Add your resume and message.</li>
                <li>Review before you send.</li>
              </ol>
            </div>
          </div>
          <section className="match-help-card">
            <h3>
              {canShowPersonalizedMatch
                ? "Need Help Understanding the Score?"
                : isJobSeeker
                  ? "Add Skills to Compare This Job"
                  : isEmployer
                    ? "Match Information Is for Job Seekers"
                    : "Want to Compare This Job with Your Skills?"}
            </h3>
            {canShowPersonalizedMatch ? (
              <>
                <p>Skills count for 70%.</p>
                <p>Travel distance counts for 30%.</p>
                <p>The score never makes a hiring decision.</p>
              </>
            ) : isJobSeeker ? (
              <>
                <p>Complete your profile before JobFinder compares this job.</p>
                <p>You can still read the requirements and apply now.</p>
                <Link className="text-link" to="/onboarding/profile">
                  Complete Profile
                </Link>
              </>
            ) : isEmployer ? (
              <>
                <p>Use a job seeker account with saved skills to compare jobs.</p>
                <p>The public job details remain available here.</p>
              </>
            ) : (
              <>
                <p>Sign in and add your skills first.</p>
                <p>You can still read public job details now.</p>
              </>
            )}
          </section>
        </aside>
      </div>

      <div className="mobile-apply-bar">
        <div>
          <strong>
            {canShowPersonalizedMatch
              ? `${job.fit.overallScore}% match`
              : job.employmentType}
          </strong>
          <span>{job.route.estimatedMinutes} min estimated travel</span>
        </div>
        <button
          className="button button--primary"
          disabled={isEmployer || !isOnline}
          onClick={handleApply}
          type="button"
        >
          {isEmployer
            ? "Job Seeker Only"
            : isJobSeeker
              ? isOnline
                ? "Apply Now"
                : "Reconnect to Apply"
              : isOnline
                ? "Sign In to Apply"
                : "Reconnect to Apply"}
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
