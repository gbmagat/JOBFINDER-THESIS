import {
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
} from "react";
import {
  ArrowRight,
  Bookmark,
  BriefcaseBusiness,
  Check,
  Clock3,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import {
  SUBMITTED_APPLICATIONS_STORAGE_KEY,
  type ApplicantApplicationStatus,
  type StoredSubmittedApplication,
} from "../features/applications/storage-contract";
import {
  readApplicationReviewStatuses,
  toApplicantApplicationStatus,
} from "../features/applications/submitted-storage";
import { getAllJobs, JOBS } from "../features/jobs/data";
import { JobCard } from "../features/jobs/JobCard";
import {
  DEFAULT_SAVED_JOB_IDS,
  SAVED_JOB_IDS_KEY,
} from "../features/jobs/saved-jobs";
import {
  COMMUTE_MINUTES_KEY,
  DEFAULT_PROFILE_DETAILS,
  DEFAULT_PROFILE_SKILLS,
  PROFILE_DETAILS_KEY,
  PROFILE_SKILLS_KEY,
  WORK_TYPES_KEY,
} from "../features/profile/storage";
import { usePersistentState } from "../lib/usePersistentState";
import { userStorageKey } from "../lib/storage-keys";

type ApplicationStatus = ApplicantApplicationStatus;

interface AccountHeaderProps {
  actions?: ReactNode;
  description: string;
  eyebrow: string;
  icon: LucideIcon;
  title: string;
}

interface ApplicationSeed {
  appliedAt: string;
  jobId: string;
  status: ApplicationStatus;
}

const applicationSeeds = [
  {
    jobId: "it-support-assistant-lumina-tech",
    appliedAt: "2026-07-18",
    status: "Under review",
  },
  {
    jobId: "customer-service-associate-clarkconnect",
    appliedAt: "2026-07-15",
    status: "Shortlisted",
  },
  {
    jobId: "junior-web-developer-pixelnorth",
    appliedAt: "2026-07-12",
    status: "Submitted",
  },
] as const satisfies readonly ApplicationSeed[];

type AccountApplication = {
  appliedAt: string;
  employerName: string;
  id: string;
  jobId: string;
  location: string;
  nextAction: string;
  status: ApplicationStatus;
  title: string;
};

const seededApplications: AccountApplication[] = applicationSeeds.flatMap((seed) => {
  const job = JOBS.find((candidate) => candidate.id === seed.jobId);
  return job
    ? [
        {
          appliedAt: seed.appliedAt,
          employerName: job.employerName,
          id: `seed-${seed.jobId}`,
          jobId: seed.jobId,
          location: job.location.barangay,
          nextAction:
            seed.status === "Shortlisted"
              ? "Prepare for employer contact"
              : seed.status === "Under review"
                ? "Keep your contact details current"
                : "Wait for employer review",
          status: seed.status,
          title: job.title,
        },
      ]
    : [];
});

const workTypeOptions = [
  "Full-time",
  "Part-time",
  "Hybrid",
  "Remote",
] as const;
const APPLICATION_NOTES_STORAGE_KEY = "jobfinder.application-notes.v1";
const PROFILE_DISCOVERABILITY_STORAGE_KEY =
  "jobfinder.profile-discoverability.v1";

function AccountHeader({
  actions,
  description,
  eyebrow,
  icon: Icon,
  title,
}: AccountHeaderProps) {
  return (
    <header className="page-header page-header--split">
      <div className="page-header__copy">
        <span className="eyebrow">
          <Icon size={16} aria-hidden="true" />
          {eyebrow}
        </span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="cluster">{actions}</div> : null}
    </header>
  );
}

function SavedJobsView({ displayName }: { displayName: string }) {
  const { user } = useAuth();
  const allJobs = useMemo(() => getAllJobs(), []);
  const [savedJobIds] = usePersistentState<string[]>(
    userStorageKey(SAVED_JOB_IDS_KEY, user?.id),
    DEFAULT_SAVED_JOB_IDS,
  );
  const savedJobs = useMemo(
    () =>
      savedJobIds.flatMap((jobId) => {
        const job = allJobs.find((candidate) => candidate.id === jobId);
        return job ? [job] : [];
      }),
    [allJobs, savedJobIds],
  );

  return (
    <>
      <AccountHeader
        actions={
          <span className="quiet-badge">
            {savedJobs.length} {savedJobs.length === 1 ? "job" : "jobs"}
          </span>
        }
        description={`Revisit opportunities saved by ${displayName}.`}
        eyebrow="Private workspace"
        icon={Bookmark}
        title="Saved jobs"
      />

      {savedJobs.length ? (
        <div className="job-list">
          {savedJobs.map((job) => (
            <JobCard job={job} key={job.id} showSummary={false} />
          ))}
        </div>
      ) : (
        <section className="empty-state">
          <span className="empty-state__icon">
            <Bookmark size={26} aria-hidden="true" />
          </span>
          <h2>No saved jobs yet</h2>
          <p>Save an opportunity while browsing and it will appear here.</p>
          <Link className="button button--primary" to="/jobs">
            Browse jobs
          </Link>
        </section>
      )}
    </>
  );
}

function statusBadgeClass(status: ApplicationStatus): string {
  if (status === "Shortlisted") return "badge badge--success";
  if (status === "Not selected") return "badge badge--outline";
  if (status === "Submitted") return "badge badge--warning";
  return "badge badge--blue";
}

function nextActionForStatus(status: ApplicationStatus): string {
  if (status === "Shortlisted") {
    return "Prepare for employer contact";
  }
  if (status === "Under review") {
    return "Keep your contact details current";
  }
  if (status === "Not selected") {
    return "Continue exploring other suitable roles";
  }
  return "Wait for employer review";
}

function ApplicationsView() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedApplicationId, setSelectedApplicationId] = useState<
    string | null
  >(null);
  const [applicationNotes, setApplicationNotes] = usePersistentState<
    Record<string, string>
  >(userStorageKey(APPLICATION_NOTES_STORAGE_KEY, user?.id), {});
  const [submittedApplications] = usePersistentState<
    StoredSubmittedApplication[]
  >(
    userStorageKey(SUBMITTED_APPLICATIONS_STORAGE_KEY, user?.id),
    [],
  );
  const reviewStatuses = useMemo(
    () => readApplicationReviewStatuses(user?.id),
    [user?.id],
  );
  const applications = useMemo<AccountApplication[]>(() => {
    const submitted = submittedApplications.flatMap((application) => {
      if (
        !application ||
        application.version !== 1 ||
        typeof application.id !== "string" ||
        typeof application.jobId !== "string" ||
        typeof application.jobTitle !== "string" ||
        typeof application.employerName !== "string" ||
        typeof application.location !== "string" ||
        typeof application.appliedAt !== "string" ||
        application.status !== "Submitted"
      ) {
        return [];
      }

      const reviewStatus = reviewStatuses[application.id];
      const status =
        reviewStatus &&
        reviewStatus.jobId === application.jobId &&
        reviewStatus.recipientEmployerId === application.recipientEmployerId
          ? toApplicantApplicationStatus(reviewStatus.status)
          : application.status;

      return [
        {
          appliedAt: application.appliedAt,
          employerName: application.employerName,
          id: application.id,
          jobId: application.jobId,
          location: application.location,
          nextAction: nextActionForStatus(status),
          status,
          title: application.jobTitle,
        },
      ];
    });
    const submittedJobIds = new Set(
      submitted.map((application) => application.jobId),
    );

    return [
      ...submitted,
      ...seededApplications.filter(
        (application) => !submittedJobIds.has(application.jobId),
      ),
    ].sort(
      (first, second) =>
        Date.parse(second.appliedAt) - Date.parse(first.appliedAt),
    );
  }, [reviewStatuses, submittedApplications]);

  const filteredApplications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return applications;
    }

    return applications.filter(({ employerName, location, status, title }) =>
      [title, employerName, location, status]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [applications, query]);

  const underReviewCount = applications.filter(
    ({ status }) => status === "Under review",
  ).length;
  const shortlistedCount = applications.filter(
    ({ status }) => status === "Shortlisted",
  ).length;
  const selectedApplication =
    applications.find(
      (application) => application.id === selectedApplicationId,
    ) ??
    filteredApplications[0] ??
    applications[0];
  const trackerSteps = selectedApplication
    ? [
        {
          label: "Application submitted",
          state: "complete",
          detail: new Intl.DateTimeFormat("en-PH", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(selectedApplication.appliedAt)),
        },
        {
          label: "Employer review",
          state:
            selectedApplication.status === "Submitted"
              ? "current"
              : "complete",
          detail:
            selectedApplication.status === "Submitted"
              ? "Waiting for the employer"
              : "Employer opened your application",
        },
        {
          label: "Shortlist or decision",
          state:
            selectedApplication.status === "Shortlisted" ||
            selectedApplication.status === "Not selected"
              ? "current"
              : "upcoming",
          detail:
            selectedApplication.status === "Shortlisted"
              ? "The employer may contact you next"
              : selectedApplication.status === "Not selected"
                ? "The employer has completed this review"
              : "No decision has been recorded",
        },
      ]
    : [];

  return (
    <>
      <AccountHeader
        actions={
          <form
            className="search-bar search-bar--wide account-search"
            onSubmit={(event) => event.preventDefault()}
            role="search"
          >
            <Search size={18} aria-hidden="true" />
            <label className="sr-only" htmlFor="application-search">
              Search your applications
            </label>
            <input
              id="application-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your applications"
              type="search"
              value={query}
            />
          </form>
        }
        description="Track the progress of jobs you applied to."
        eyebrow="Private workspace"
        icon={BriefcaseBusiness}
        title="Applications"
      />

      <div className="metric-grid" aria-label="Application summary">
        <article className="metric-card">
          <BriefcaseBusiness size={22} aria-hidden="true" />
          <strong>{applications.length}</strong>
          <span>Total applications</span>
        </article>
        <article className="metric-card">
          <Clock3 size={22} aria-hidden="true" />
          <strong>{underReviewCount}</strong>
          <span>Under review</span>
        </article>
        <article className="metric-card">
          <Check size={22} aria-hidden="true" />
          <strong>{shortlistedCount}</strong>
          <span>Shortlisted</span>
        </article>
      </div>

      <section
        className="surface applications-history"
        aria-labelledby="application-history-heading"
      >
        <header className="surface__header">
          <div>
            <h2 id="application-history-heading">Application history</h2>
            <p className="text-sm muted">
              Employers control review and hiring decisions.
            </p>
          </div>
          <span className="quiet-badge">Updated today</span>
        </header>

        {filteredApplications.length ? (
          <div
            className="applications-table-wrap"
            role="region"
            aria-label="Scrollable application history"
            tabIndex={0}
          >
            <table className="applications-table">
              <caption className="sr-only">
                Your submitted JobFinder applications
              </caption>
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col">Applied</th>
                  <th scope="col">Status</th>
                  <th scope="col">Next action</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map(
                  ({
                    appliedAt,
                    employerName,
                    id,
                    jobId,
                    location,
                    nextAction,
                    status,
                    title,
                  }) => (
                    <tr key={id}>
                      <td data-label="Role">
                        <strong>{title}</strong>
                        <span>
                          {employerName} · {location}
                        </span>
                      </td>
                      <td data-label="Applied">
                        <time dateTime={appliedAt}>
                          {new Intl.DateTimeFormat("en-PH", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }).format(new Date(appliedAt))}
                        </time>
                      </td>
                      <td data-label="Status">
                        <span className={statusBadgeClass(status)}>
                          {status}
                        </span>
                      </td>
                      <td data-label="Next action">{nextAction}</td>
                      <td data-label="Action">
                        <button
                          aria-pressed={selectedApplication?.id === id}
                          className="text-link"
                          onClick={() => setSelectedApplicationId(id)}
                          type="button"
                        >
                          Track
                        </button>
                        <Link
                          className="text-link"
                          to={`/jobs/${encodeURIComponent(jobId)}`}
                          aria-label={`View job details for your ${title} application`}
                        >
                          Job <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="surface__body empty-state" aria-live="polite">
            <span className="empty-state__icon">
              <Search size={24} aria-hidden="true" />
            </span>
            <h2>No applications found</h2>
            <p>Try searching by role, employer, location, or status.</p>
          </div>
        )}

        {selectedApplication ? (
          <section
            className="application-tracker"
            aria-labelledby="application-tracker-heading"
          >
            <header className="application-tracker__header">
              <div>
                <p className="kicker">Application tracker</p>
                <h3 id="application-tracker-heading">
                  {selectedApplication.title}
                </h3>
                <p>
                  {selectedApplication.employerName} ·{" "}
                  {selectedApplication.location}
                </p>
              </div>
              <span className={statusBadgeClass(selectedApplication.status)}>
                {selectedApplication.status}
              </span>
            </header>
            <div className="application-tracker__layout">
              <div>
                <strong>Next action</strong>
                <p>{selectedApplication.nextAction}</p>
                <ol className="application-timeline">
                  {trackerSteps.map((item) => (
                    <li className={`is-${item.state}`} key={item.label}>
                      <span aria-hidden="true" />
                      <div>
                        <strong>{item.label}</strong>
                        <small>{item.detail}</small>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <label className="field">
                <span className="field-label">Private note</span>
                <textarea
                  className="textarea"
                  maxLength={600}
                  onChange={(event) =>
                    setApplicationNotes((current) => ({
                      ...current,
                      [selectedApplication.id]: event.target.value,
                    }))
                  }
                  placeholder="Add interview details, reminders, or questions."
                  rows={6}
                  value={applicationNotes[selectedApplication.id] ?? ""}
                />
                <span className="field-hint">
                  Visible only in this account on this device.
                </span>
              </label>
            </div>
          </section>
        ) : null}
      </section>
    </>
  );
}

function ProfileView({
  displayName,
  email,
}: {
  displayName: string;
  email: string;
}) {
  const { user } = useAuth();
  const [profileDetails] = usePersistentState(
    userStorageKey(PROFILE_DETAILS_KEY, user?.id),
    DEFAULT_PROFILE_DETAILS,
  );
  const [profileSkills] = usePersistentState<string[]>(
    userStorageKey(PROFILE_SKILLS_KEY, user?.id),
    DEFAULT_PROFILE_SKILLS,
  );
  const [isDiscoverable, setIsDiscoverable] = usePersistentState(
    userStorageKey(PROFILE_DISCOVERABILITY_STORAGE_KEY, user?.id),
    false,
  );
  const readinessChecks = [
    Boolean(displayName.trim()),
    Boolean(profileDetails.mobileNumber.trim()),
    Boolean(profileDetails.barangay.trim()),
    profileSkills.length >= 3,
  ];
  const readiness = Math.round(
    (readinessChecks.filter(Boolean).length / readinessChecks.length) * 100,
  );

  return (
    <>
      <AccountHeader
        actions={
          <Link
            className="button button--secondary"
            to="/onboarding/profile?returnTo=/profile"
          >
            Edit personal details
          </Link>
        }
        description="Review the information used for applications and matching."
        eyebrow="Private workspace"
        icon={UserRound}
        title="Your profile"
      />

      <div className="split-layout">
        <div className="stack stack--3">
          <section className="surface" aria-labelledby="personal-heading">
            <header className="surface__header">
              <div>
                <h2 id="personal-heading">Personal information</h2>
                <p className="text-sm muted">
                  Shared only with employers you apply to.
                </p>
              </div>
              <UserRound size={20} aria-hidden="true" />
            </header>
            <div className="surface__body">
              <dl className="definition-list">
                <div className="definition-row">
                  <dt>Full name</dt>
                  <dd>{displayName}</dd>
                </div>
                <div className="definition-row">
                  <dt>Email</dt>
                  <dd>
                    <a className="text-link" href={`mailto:${email}`}>
                      <Mail size={15} aria-hidden="true" /> {email}
                    </a>
                  </dd>
                </div>
                <div className="definition-row">
                  <dt>Mobile</dt>
                  <dd>
                    <span className="cluster">
                      <Phone size={15} aria-hidden="true" />{" "}
                      {profileDetails.mobileNumber || "Not added"}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
            <footer className="surface__footer">
              <Link
                className="text-link"
                to="/onboarding/profile?returnTo=/profile"
              >
                Update personal information{" "}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </footer>
          </section>

          <section className="surface" aria-labelledby="location-heading">
            <header className="surface__header">
              <div>
                <h2 id="location-heading">Home location</h2>
                <p className="text-sm muted">
                  Used to estimate distance and travel time.
                </p>
              </div>
              <MapPin size={20} aria-hidden="true" />
            </header>
            <div className="surface__body">
              <dl className="definition-list">
                <div className="definition-row">
                  <dt>Home area</dt>
                  <dd>
                    {profileDetails.barangay}, {profileDetails.city}
                  </dd>
                </div>
                <div className="definition-row">
                  <dt>Commute limit</dt>
                  <dd>{profileDetails.maximumMinutes} minutes</dd>
                </div>
              </dl>
            </div>
          </section>
        </div>

        <section className="surface" aria-labelledby="skills-heading">
          <header className="surface__header">
            <div>
              <h2 id="skills-heading">Skills</h2>
              <p className="text-sm muted">
                Exact and related skills improve your recommendations.
              </p>
            </div>
            <span className="quiet-badge">{profileSkills.length} added</span>
          </header>
          <div className="surface__body">
            <div className="chip-row" aria-label="Profile skills">
              {profileSkills.map((skill) => (
                <span className="chip is-active" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
            <p className="section-copy text-sm">
              JobFinder uses your profile skills as evidence for semantic skill
              matching. You can review every match reason before applying.
            </p>
          </div>
          <footer className="surface__footer cluster">
            <Link
              className="button button--primary"
              to="/onboarding/skills?returnTo=/profile"
            >
              Edit skills
            </Link>
            <Link className="button button--secondary" to="/preferences">
              Match preferences
            </Link>
          </footer>
        </section>
      </div>

      <section className="surface profile-privacy" aria-labelledby="profile-privacy-heading">
        <header className="surface__header">
          <div>
            <p className="kicker">Readiness and privacy</p>
            <h2 id="profile-privacy-heading">Control how your profile is used</h2>
          </div>
          <span className="quiet-badge">{readiness}% ready</span>
        </header>
        <div className="surface__body profile-privacy__layout">
          <div>
            <div
              aria-label={`Profile readiness ${readiness}%`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={readiness}
              className="progress-track"
              role="progressbar"
            >
              <span
                className="progress-value"
                style={{ width: `${readiness}%` }}
              />
            </div>
            <ul className="profile-privacy__list">
              <li>
                <ShieldCheck size={17} aria-hidden="true" />
                Contact details are shared only with employers you apply to.
              </li>
              <li>
                <ShieldCheck size={17} aria-hidden="true" />
                Employers see commute evidence, never your precise home point.
              </li>
              <li>
                <ShieldCheck size={17} aria-hidden="true" />
                Every recommendation shows the skills that influenced it.
              </li>
            </ul>
          </div>
          <label className="check-field profile-discoverability">
            <input
              checked={isDiscoverable}
              onChange={(event) => setIsDiscoverable(event.target.checked)}
              type="checkbox"
            />
            <span>
              <strong>Allow profile discovery</strong>
              <small>
                Let verified direct employers find this skills profile even
                before you apply. This stays off by default.
              </small>
            </span>
          </label>
        </div>
      </section>
    </>
  );
}

function PreferencesView() {
  const { user } = useAuth();
  const [commuteMinutes, setCommuteMinutes] = usePersistentState(
    userStorageKey(COMMUTE_MINUTES_KEY, user?.id),
    "35",
  );
  const [selectedWorkTypes, setSelectedWorkTypes] = usePersistentState<string[]>(
    userStorageKey(WORK_TYPES_KEY, user?.id),
    ["Full-time", "Hybrid"],
  );
  const [skills, setSkills] = usePersistentState<string[]>(
    userStorageKey(PROFILE_SKILLS_KEY, user?.id),
    DEFAULT_PROFILE_SKILLS,
  );
  const [skillDraft, setSkillDraft] = useState("");
  const [saved, setSaved] = useState(false);

  function toggleWorkType(workType: string) {
    setSelectedWorkTypes((current) => {
      return current.includes(workType)
        ? current.filter((item) => item !== workType)
        : [...current, workType];
    });
    setSaved(false);
  }

  function addSkill() {
    const nextSkill = skillDraft.trim();
    if (
      !nextSkill ||
      skills.some(
        (skill) => skill.toLowerCase() === nextSkill.toLowerCase(),
      )
    ) {
      return;
    }

    setSkills((current) => [...current, nextSkill]);
    setSkillDraft("");
    setSaved(false);
  }

  function removeSkill(skillToRemove: string) {
    setSkills((current) =>
      current.filter((skill) => skill !== skillToRemove),
    );
    setSaved(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);
  }

  return (
    <>
      <AccountHeader
        description="Control the commute, work types, and skills used to rank jobs."
        eyebrow="Private workspace"
        icon={Settings2}
        title="Match preferences"
      />

      <form className="form" onSubmit={handleSubmit}>
        <section className="surface" aria-labelledby="travel-heading">
          <header className="surface__header">
            <div>
              <h2 id="travel-heading">Travel and work setup</h2>
              <p className="text-sm muted">
                These choices filter and rank recommendations.
              </p>
            </div>
            <MapPin size={20} aria-hidden="true" />
          </header>
          <div className="surface__body form-grid form-grid--2">
            <label className="field">
              <span className="field-label">Maximum commute</span>
              <select
                className="select"
                onChange={(event) => {
                  setCommuteMinutes(event.target.value);
                  setSaved(false);
                }}
                value={commuteMinutes}
              >
                <option value="20">20 minutes</option>
                <option value="30">30 minutes</option>
                <option value="35">35 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
              </select>
              <span className="field-hint">
                JobFinder still shows jobs outside this limit when you search
                for them directly.
              </span>
            </label>

            <fieldset className="filter-group">
              <legend>Preferred work types</legend>
              {workTypeOptions.map((workType) => (
                <label className="check-field" key={workType}>
                  <input
                    checked={selectedWorkTypes.includes(workType)}
                    onChange={() => toggleWorkType(workType)}
                    type="checkbox"
                  />
                  <span>{workType}</span>
                </label>
              ))}
            </fieldset>
          </div>
        </section>

        <section className="surface" aria-labelledby="preference-skills-heading">
          <header className="surface__header">
            <div>
              <h2 id="preference-skills-heading">Skills to prioritize</h2>
              <p className="text-sm muted">
                Add skills you want JobFinder to emphasize in recommendations.
              </p>
            </div>
            <span className="quiet-badge">{skills.length} selected</span>
          </header>
          <div className="surface__body stack stack--2">
            <div className="cluster preferences-skill-editor">
              <label className="sr-only" htmlFor="preference-skill">
                Add a skill
              </label>
              <input
                className="input preferences-skill-input"
                id="preference-skill"
                onChange={(event) => {
                  setSkillDraft(event.target.value);
                  setSaved(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="Type a skill, for example customer service"
                type="text"
                value={skillDraft}
              />
              <button
                className="button button--secondary"
                onClick={addSkill}
                type="button"
              >
                <Plus size={17} aria-hidden="true" />
                Add skill
              </button>
            </div>

            <div className="chip-row" aria-label="Prioritized skills">
              {skills.map((skill) => (
                <button
                  className="chip is-active"
                  key={skill}
                  onClick={() => removeSkill(skill)}
                  type="button"
                  aria-label={`Remove ${skill}`}
                >
                  {skill}
                  <X size={14} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
          <footer className="surface__footer cluster cluster--between">
            <p className="text-sm muted">
              {skills.length
                ? "Selected skills influence your skill-fit score."
                : "Add at least one skill for personalized recommendations."}
            </p>
            <button className="button button--primary" type="submit">
              Save preferences
            </button>
          </footer>
        </section>

        <div aria-live="polite" role="status">
          {saved ? (
            <p className="alert alert--success">
              <Check size={18} aria-hidden="true" />
              Preferences saved for this frontend session.
            </p>
          ) : null}
        </div>
      </form>
    </>
  );
}

export function AccountPage() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const displayName = user?.displayName ?? "Job seeker";
  const email = user?.email ?? "jobseeker@example.com";

  let content: ReactNode;
  switch (pathname) {
    case "/saved":
      content = <SavedJobsView displayName={displayName} />;
      break;
    case "/applications":
      content = <ApplicationsView />;
      break;
    case "/preferences":
      content = <PreferencesView />;
      break;
    case "/profile":
    default:
      content = <ProfileView displayName={displayName} email={email} />;
      break;
  }

  return (
    <div className="page account-page">
      <div className="page-container">{content}</div>
    </div>
  );
}
