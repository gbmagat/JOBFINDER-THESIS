import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowRight,
  Bookmark,
  BriefcaseBusiness,
  Check,
  Clock3,
  Plus,
  Search,
  Settings2,
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
import { JobCard } from "../features/jobs/JobCard";
import { useJobs } from "../features/jobs/JobsContext";
import type { JobListing } from "../features/jobs/types";
import {
  DEFAULT_SAVED_JOB_IDS,
  SAVED_JOB_IDS_KEY,
} from "../features/jobs/saved-jobs";
import {
  DEFAULT_PROFILE_DETAILS,
  DEFAULT_PROFILE_SKILLS,
  PROFILE_DETAILS_KEY,
  PROFILE_SKILLS_KEY,
  WORK_TYPES_KEY,
} from "../features/profile/storage";
import { usePersistentState } from "../lib/usePersistentState";
import { userStorageKey } from "../lib/storage-keys";
import { apiRequest } from "../lib/api";

type ApplicationStatus = ApplicantApplicationStatus;

interface AccountHeaderProps {
  actions?: ReactNode;
  description: string;
  eyebrow: string;
  icon: LucideIcon;
  title: string;
}

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

type ApiProfile = {
  fullName: string;
  mobileNumber: string;
  barangay: string;
  city: string;
  homeNodeId: string;
  preferredWorkTypes: string[];
  skills: { name: string }[];
};

const workTypeOptions = [
  "Full-time",
  "Part-time",
  "Hybrid",
  "Remote",
] as const;
const APPLICATION_NOTES_STORAGE_KEY = "jobfinder.application-notes.v1";

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
  const { jobs: allJobs } = useJobs();
  const [savedJobIds, setSavedJobIds] = usePersistentState<string[]>(
    userStorageKey(SAVED_JOB_IDS_KEY, user?.id),
    DEFAULT_SAVED_JOB_IDS,
  );
  const [serverSavedJobs, setServerSavedJobs] = useState<JobListing[] | null>(
    null,
  );

  useEffect(() => {
    if (!user || import.meta.env.MODE === "test") return;

    let active = true;
    apiRequest<{ jobs: JobListing[] }>("/saved-jobs")
      .then(({ jobs }) => {
        if (!active) return;
        setSavedJobIds(jobs.map((job) => job.id));
        setServerSavedJobs(jobs);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [setSavedJobIds, user]);
  const locallyResolvedJobs = useMemo(
    () =>
      savedJobIds.flatMap((jobId) => {
        const job = allJobs.find((candidate) => candidate.id === jobId);
        return job ? [job] : [];
      }),
    [allJobs, savedJobIds],
  );
  const savedJobs = serverSavedJobs ?? locallyResolvedJobs;

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
        title="Saved Jobs"
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
          <h2>No Saved Jobs Yet</h2>
          <p>Save an opportunity while browsing and it will appear here.</p>
          <Link className="button button--primary" to="/jobs">
            Browse Jobs
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
  const [serverApplications, setServerApplications] = useState<
    AccountApplication[] | null
  >(null);
  const reviewStatuses = useMemo(
    () => readApplicationReviewStatuses(user?.id),
    [user?.id],
  );
  const storedApplications = useMemo<AccountApplication[]>(() => {
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
    return submitted.sort(
      (first, second) =>
        Date.parse(second.appliedAt) - Date.parse(first.appliedAt),
    );
  }, [reviewStatuses, submittedApplications]);

  useEffect(() => {
    if (!user || import.meta.env.MODE === "test") return;

    let active = true;
    setServerApplications(null);
    apiRequest<{
      applications: {
        id: string;
        jobId: string;
        jobTitle: string;
        employerName: string;
        location?: { barangay?: string; city?: string };
        status: ApplicationStatus;
        submittedAt: string;
      }[];
    }>("/applications")
      .then(({ applications }) => {
        if (!active) return;
        setServerApplications(
          applications.map((application) => ({
            appliedAt: application.submittedAt,
            employerName: application.employerName,
            id: application.id,
            jobId: application.jobId,
            location:
              [application.location?.barangay, application.location?.city]
                .filter(Boolean)
                .join(", ") || "Angeles City",
            nextAction: nextActionForStatus(application.status),
            status: application.status,
            title: application.jobTitle,
          })),
        );
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [user]);

  const applications = serverApplications ?? storedApplications;

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
            <h2 id="application-history-heading">Application History</h2>
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
            <h2>
              {applications.length
                ? "No Applications Found"
                : "No Applications Yet"}
            </h2>
            <p>
              {applications.length
                ? "Try searching by role, employer, location, or status."
                : "Applications you submit will appear here."}
            </p>
            {!applications.length ? (
              <Link className="button button--primary" to="/jobs">
                Browse Local Jobs
              </Link>
            ) : null}
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
  const [profileDetails, setProfileDetails] = usePersistentState(
    userStorageKey(PROFILE_DETAILS_KEY, user?.id),
    DEFAULT_PROFILE_DETAILS,
  );
  const [profileSkills, setProfileSkills] = usePersistentState<string[]>(
    userStorageKey(PROFILE_SKILLS_KEY, user?.id),
    DEFAULT_PROFILE_SKILLS,
  );

  useEffect(() => {
    if (!user || import.meta.env.MODE === "test") return;

    let active = true;
    apiRequest<{ profile: ApiProfile }>("/profile")
      .then(({ profile }) => {
        if (!active) return;
        setProfileDetails({
          fullName: profile.fullName,
          mobileNumber: profile.mobileNumber,
          barangay: profile.barangay,
          city: profile.city,
        });
        setProfileSkills(profile.skills.map((skill) => skill.name));
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [setProfileDetails, setProfileSkills, user]);
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
          Edit Personal Details
          </Link>
        }
        description="Review what employers can see and improve your job matches."
        eyebrow="Private profile"
        icon={UserRound}
        title="Your Profile"
      />

      <div className="profile-overview-grid">
        <section className="surface profile-overview-card" aria-labelledby="personal-heading">
          <header className="surface__header">
            <div>
              <h2 id="personal-heading">Personal Information</h2>
              <p className="text-sm muted">
                Shared only with employers you apply to.
              </p>
            </div>
          </header>
          <div className="surface__body">
            <dl className="definition-list">
              <div className="definition-row">
                <dt>Full name</dt>
                <dd>{profileDetails.fullName || displayName}</dd>
              </div>
              <div className="definition-row">
                <dt>Email</dt>
                <dd>
                  <a className="text-link" href={`mailto:${email}`}>
                    {email}
                  </a>
                </dd>
              </div>
              <div className="definition-row">
                <dt>Mobile</dt>
                <dd>{profileDetails.mobileNumber || "Not added"}</dd>
              </div>
            </dl>
          </div>
          <footer className="surface__footer">
            <Link
              className="text-link"
              to="/onboarding/profile?returnTo=/profile"
            >
              Update Personal Information
            </Link>
          </footer>
        </section>

        <section className="surface profile-overview-card" aria-labelledby="skills-heading">
          <header className="surface__header">
            <div>
              <h2 id="skills-heading">Skills</h2>
              <p className="text-sm muted">
                Add skills using words you know.
              </p>
            </div>
            <span className="quiet-badge">{profileSkills.length} added</span>
          </header>
          <div className="surface__body">
            <div className="chip-row" aria-label="Profile skills">
              {profileSkills.map((skill) => (
                <span className="chip" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
            <div className="stack stack--1 profile-skills-note">
              <p className="text-sm muted">
                Related skills can also help find suitable jobs.
              </p>
              <p className="text-sm muted">
                You can review every reason before applying.
              </p>
            </div>
          </div>
          <footer className="surface__footer cluster">
            <Link
              className="button button--primary"
              to="/onboarding/skills?returnTo=/profile"
            >
              Add Skill
            </Link>
            <Link className="button button--secondary" to="/preferences">
              Match Preferences
            </Link>
          </footer>
        </section>

        <section className="surface profile-overview-card" aria-labelledby="location-heading">
          <header className="surface__header">
            <h2 id="location-heading">Home Area</h2>
          </header>
          <div className="surface__body">
            <dl className="definition-list">
              <div className="definition-row">
                <dt>Home area</dt>
                <dd>
                  {profileDetails.barangay}, {profileDetails.city}
                </dd>
              </div>
            </dl>
          </div>
          <footer className="surface__footer">
            <Link
              className="button button--secondary"
              to="/onboarding/profile?returnTo=/profile"
            >
              Edit Home Area
            </Link>
          </footer>
        </section>

        <section
          className="surface profile-overview-card profile-privacy-card"
          aria-labelledby="profile-privacy-heading"
        >
          <header className="surface__header">
            <h2 id="profile-privacy-heading">Your Privacy</h2>
          </header>
          <div className="surface__body">
            <ul className="profile-privacy__list">
              <li>Contact details are shared only after you apply.</li>
              <li>Employers see location evidence, not your exact home point.</li>
            </ul>
            <p className="profile-privacy__confirmation">
              ✓ Profile is private by default
            </p>
          </div>
        </section>
      </div>

      <section className="surface profile-readiness" aria-labelledby="profile-readiness-heading">
        <div className="profile-readiness__row">
          <h2 id="profile-readiness-heading">Profile Readiness</h2>
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
          <span className="quiet-badge">{readiness}% ready</span>
        </div>
        <p>Add your mobile number to make applications easier.</p>
      </section>
    </>
  );
}

function PreferencesView() {
  const { user } = useAuth();
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
  const [saveError, setSaveError] = useState("");
  const [apiProfile, setApiProfile] = useState<ApiProfile | null>(null);

  useEffect(() => {
    if (!user || import.meta.env.MODE === "test") return;

    let active = true;
    apiRequest<{ profile: ApiProfile }>("/profile")
      .then(({ profile }) => {
        if (!active) return;
        setApiProfile(profile);
        setSelectedWorkTypes(profile.preferredWorkTypes);
        setSkills(profile.skills.map((skill) => skill.name));
      })
      .catch(() => {
        if (active) setSaveError("JobFinder could not load your preferences.");
      });

    return () => {
      active = false;
    };
  }, [setSelectedWorkTypes, setSkills, user]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (import.meta.env.MODE === "test") {
      setSaved(true);
      return;
    }
    if (!apiProfile) {
      setSaveError("JobFinder could not save your preferences yet.");
      return;
    }

    setSaved(false);
    setSaveError("");
    try {
      const [{ profile }] = await Promise.all([
        apiRequest<{ profile: ApiProfile }>("/profile", {
          method: "PUT",
          body: JSON.stringify({
            fullName: apiProfile.fullName,
            mobileNumber: apiProfile.mobileNumber,
            barangay: apiProfile.barangay,
            city: apiProfile.city,
            homeNodeId: apiProfile.homeNodeId,
            preferredWorkTypes: selectedWorkTypes,
          }),
        }),
        apiRequest<{ profile: ApiProfile }>("/profile/skills", {
          method: "PUT",
          body: JSON.stringify({ skills }),
        }),
      ]);
      setApiProfile(profile);
      setSaved(true);
      window.dispatchEvent(new Event("jobfinder:profile-updated"));
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "JobFinder could not save your preferences.",
      );
    }
  }

  return (
    <>
      <AccountHeader
        description="Control the work types and skills used to rank jobs."
        eyebrow="Private workspace"
        icon={Settings2}
        title="Match Preferences"
      />

      <form className="form" onSubmit={handleSubmit}>
        <section className="surface" aria-labelledby="work-preferences-heading">
          <header className="surface__header">
            <div>
              <h2 id="work-preferences-heading">Work Preferences</h2>
              <p className="text-sm muted">
                These choices help rank recommendations.
              </p>
            </div>
          </header>
          <div className="surface__body">
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
              <h2 id="preference-skills-heading">Skills to Prioritize</h2>
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
                Add Skill
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
              Preferences saved.
            </p>
          ) : null}
          {saveError ? <p className="alert alert--danger">{saveError}</p> : null}
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
