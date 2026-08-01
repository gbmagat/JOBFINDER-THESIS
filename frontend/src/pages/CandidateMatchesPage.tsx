import {
  ArrowLeft,
  BriefcaseBusiness,
  ChevronDown,
  FileText,
  Filter,
  Info,
  MapPin,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import {
  CANDIDATE_STATUSES_STORAGE_KEY,
  type EmployerReviewStatus,
  type StoredSubmittedApplication,
} from "../features/applications/storage-contract";
import {
  readEmployerApplications,
  writeApplicationReviewStatus,
} from "../features/applications/submitted-storage";
import { isLuminaDemoEmployer } from "../features/employer/demo-workspace";
import { getJobById } from "../features/jobs/data";
import { readPublishedEmployerPosts } from "../features/jobs/employer-posts";
import { userStorageKey } from "../lib/storage-keys";
import { usePersistentState } from "../lib/usePersistentState";
import { apiRequest } from "../lib/api";

type ReviewStatus = EmployerReviewStatus;

type Candidate = {
  id: string;
  name: string;
  role: string;
  appliedAt: string;
  overallScore: number;
  skillScore: number;
  locationScore: number;
  distance: string;
  exactSkills: string[];
  relatedSkills: { candidate: string; required: string }[];
  missingSkills: string[];
  summary: string;
  initialStatus: ReviewStatus;
  hasMatch?: boolean;
  application?: {
    email: string;
    message: string;
    mobile: string;
    resumeAvailable?: boolean;
    resumeName: string;
  };
};

type EmployerApiJob = {
  id: string;
  title: string;
};

type EmployerApiFit = {
  exactSkills: { label: string }[];
  locationScore: number;
  missingSkills: { label: string }[];
  overallScore: number;
  relatedSkills: { label: string; ontologyPath?: string[] }[];
  skillScore: number;
  summary: string;
};

type EmployerApiApplication = {
  applicant: {
    email: string;
    fullName: string;
    mobileNumber: string;
  };
  fit: EmployerApiFit | null;
  id: string;
  jobId: string;
  message: string;
  resume: {
    available: boolean;
    name: string;
  };
  status: "Submitted" | "Under review" | "Shortlisted" | "Not selected";
  submittedAt: string;
};

type EmployerJobOption = {
  applications: number;
  id: string;
  title: string;
};

const seededJobs = [
  {
    id: "it-support-assistant-lumina-tech",
    title: "IT Support Assistant",
    applications: 18,
  },
  {
    id: "direct-customer-service",
    title: "Customer Service Associate",
    applications: 26,
  },
] as const;

const itSupportCandidates: Candidate[] = [
  {
    id: "maria-santos",
    name: "Maria Santos",
    role: "IT Support Technician",
    appliedAt: "July 27, 2026 · 8:42 AM",
    overallScore: 94,
    skillScore: 96,
    locationScore: 90,
    distance: "5.2 km",
    exactSkills: ["Troubleshooting", "Windows", "Communication"],
    relatedSkills: [
      { candidate: "Help desk support", required: "Technical support" },
    ],
    missingSkills: [],
    summary:
      "Matches the main technical skills and has strong location evidence.",
    initialStatus: "New",
  },
  {
    id: "carlo-dizon",
    name: "Carlo Dizon",
    role: "Service Desk Associate",
    appliedAt: "July 26, 2026 · 3:18 PM",
    overallScore: 91,
    skillScore: 87,
    locationScore: 100,
    distance: "2.8 km",
    exactSkills: ["Troubleshooting", "Communication"],
    relatedSkills: [
      { candidate: "Desktop support", required: "Technical support" },
      { candidate: "Windows 11", required: "Windows" },
    ],
    missingSkills: [],
    summary:
      "The closest candidate in this set, with two related skills that fit the job.",
    initialStatus: "Reviewing",
  },
  {
    id: "alyssa-reyes",
    name: "Alyssa Reyes",
    role: "Junior Systems Assistant",
    appliedAt: "July 25, 2026 · 11:05 AM",
    overallScore: 86,
    skillScore: 86,
    locationScore: 86,
    distance: "7.4 km",
    exactSkills: ["Windows", "Technical support", "Communication"],
    relatedSkills: [],
    missingSkills: ["Troubleshooting"],
    summary:
      "Matches most skills and has useful location evidence. Troubleshooting still needs review.",
    initialStatus: "Shortlisted",
  },
  {
    id: "jerome-cruz",
    name: "Jerome Cruz",
    role: "Computer Technician",
    appliedAt: "July 24, 2026 · 5:31 PM",
    overallScore: 80,
    skillScore: 78,
    locationScore: 83,
    distance: "9.1 km",
    exactSkills: ["Troubleshooting", "Windows"],
    relatedSkills: [
      { candidate: "Client assistance", required: "Communication" },
    ],
    missingSkills: ["Technical support"],
    summary:
      "Matches two skills and has one related skill. Technical support still needs review.",
    initialStatus: "New",
  },
] as const;

const customerServiceCandidates: Candidate[] = [
  {
    id: "bea-manalo",
    name: "Bea Manalo",
    role: "Customer Care Representative",
    appliedAt: "July 27, 2026 · 9:20 AM",
    overallScore: 93,
    skillScore: 94,
    locationScore: 90,
    distance: "4.8 km",
    exactSkills: ["Customer service", "Active listening", "Spoken English"],
    relatedSkills: [
      { candidate: "CRM notes", required: "Case documentation" },
    ],
    missingSkills: [],
    summary:
      "Matches the main customer service skills and has strong location evidence.",
    initialStatus: "New",
  },
  {
    id: "niko-garcia",
    name: "Niko Garcia",
    role: "Retail Service Associate",
    appliedAt: "July 26, 2026 · 1:05 PM",
    overallScore: 85,
    skillScore: 83,
    locationScore: 90,
    distance: "5.1 km",
    exactSkills: ["Customer service", "Active listening"],
    relatedSkills: [
      { candidate: "Retail issue logs", required: "Case documentation" },
    ],
    missingSkills: ["Spoken English"],
    summary:
      "Matches customer service and has a related documentation skill. Spoken English still needs review.",
    initialStatus: "Reviewing",
  },
];

const candidatesByJob: Record<string, Candidate[]> = {
  "it-support-assistant-lumina-tech": itSupportCandidates,
  "direct-customer-service": customerServiceCandidates,
};

function statusClass(status: ReviewStatus) {
  if (status === "Shortlisted") return "badge badge--success";
  if (status === "Not selected") return "badge badge--outline";
  if (status === "Reviewing") return "badge badge--blue";
  return "badge badge--warning";
}

function formatAppliedDate(value: string) {
  const [dateText] = value.split(" · ");
  const parsedDate = Date.parse(dateText);

  if (Number.isNaN(parsedDate)) {
    return dateText;
  }

  return new Intl.DateTimeFormat("en-PH", {
    day: "numeric",
    month: "short",
  }).format(new Date(parsedDate));
}

function submittedApplicationToCandidate(
  application: StoredSubmittedApplication,
): Candidate {
  const job = getJobById(application.jobId);
  const route = job?.route;

  return {
    id: application.id,
    name: application.applicant.fullName,
    role: job?.title ?? application.jobTitle,
    appliedAt: new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(application.appliedAt)),
    hasMatch: Boolean(job?.fit),
    overallScore: job?.fit.overallScore ?? 0,
    skillScore: job?.fit.skillScore ?? 0,
    locationScore: job?.fit.locationScore ?? 0,
    distance: route ? `${route.distanceKm} km` : "Not available",
    exactSkills: job?.fit.exactSkills.map((skill) => skill.label) ?? [],
    relatedSkills:
      job?.fit.relatedSkills.map((skill) => ({
        candidate: skill.ontologyPath?.[0] ?? skill.label,
        required: skill.label,
      })) ?? [],
    missingSkills: job?.fit.missingSkills.map((skill) => skill.label) ?? [],
    summary:
      job?.fit.summary ??
      "This application is ready for a fair, evidence-based employer review.",
    initialStatus: "New",
    application: {
      email: application.applicant.email,
      message: application.message,
      mobile: application.applicant.mobile,
      resumeName: application.resume.name,
    },
  };
}

function reviewStatusFromApi(
  status: EmployerApiApplication["status"],
): ReviewStatus {
  if (status === "Submitted") return "New";
  if (status === "Under review") return "Reviewing";
  return status;
}

function apiStatusFromReview(status: ReviewStatus) {
  if (status === "New") return "Submitted";
  if (status === "Reviewing") return "Under review";
  return status;
}

function apiApplicationToCandidate(
  application: EmployerApiApplication,
  jobTitle: string,
): Candidate {
  const fit = application.fit;

  return {
    id: application.id,
    name: application.applicant.fullName,
    role: jobTitle,
    appliedAt: application.submittedAt,
    hasMatch: Boolean(fit),
    overallScore: fit?.overallScore ?? 0,
    skillScore: fit?.skillScore ?? 0,
    locationScore: fit?.locationScore ?? 0,
    distance: "Not available",
    exactSkills: fit?.exactSkills.map((skill) => skill.label) ?? [],
    relatedSkills:
      fit?.relatedSkills.map((skill) => ({
        candidate: skill.ontologyPath?.[0] ?? skill.label,
        required: skill.label,
      })) ?? [],
    missingSkills: fit?.missingSkills.map((skill) => skill.label) ?? [],
    summary:
      fit?.summary ??
      "This applicant has not added enough profile information for a match score.",
    initialStatus: reviewStatusFromApi(application.status),
    application: {
      email: application.applicant.email,
      message: application.message,
      mobile: application.applicant.mobileNumber,
      resumeAvailable: application.resume.available,
      resumeName: application.resume.name,
    },
  };
}

export function CandidateMatchesPage() {
  const isTestMode = import.meta.env.MODE === "test";
  const { user } = useAuth();
  const isDemoEmployer = isTestMode && isLuminaDemoEmployer(user?.id);
  const { postId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedJob = postId ?? searchParams.get("job");
  const submittedApplications = useMemo(
    () => (isTestMode ? readEmployerApplications(user?.id) : []),
    [isTestMode, user?.id],
  );
  const submittedCandidatesByJob = useMemo(() => {
    return submittedApplications.reduce<Record<string, Candidate[]>>(
      (grouped, application) => {
        const candidate = submittedApplicationToCandidate(application);
        grouped[application.jobId] = [
          ...(grouped[application.jobId] ?? []),
          candidate,
        ];
        return grouped;
      },
      {},
    );
  }, [submittedApplications]);
  const testJobOptions = useMemo(() => {
    if (!isTestMode) return [];

    const persisted = readPublishedEmployerPosts(user?.id).map((post) => ({
      id: post.id,
      title: post.title,
      applications:
        (isDemoEmployer ? (candidatesByJob[post.id]?.length ?? 0) : 0) +
        (submittedCandidatesByJob[post.id]?.length ?? 0),
    }));
    const persistedIds = new Set(persisted.map((job) => job.id));
    return [
      ...persisted,
      ...(isDemoEmployer
        ? seededJobs
            .filter((job) => !persistedIds.has(job.id))
            .map((job) => ({
              ...job,
              applications:
                job.applications +
                (submittedCandidatesByJob[job.id]?.length ?? 0),
            }))
        : []),
    ];
  }, [isDemoEmployer, isTestMode, submittedCandidatesByJob, user?.id]);
  const [serverJobs, setServerJobs] = useState<EmployerJobOption[]>([]);
  const [serverCandidates, setServerCandidates] = useState<Candidate[]>([]);
  const jobOptions = isTestMode ? testJobOptions : serverJobs;
  const [selectedJob, setSelectedJob] = useState(
    isTestMode
      ? testJobOptions.some((job) => job.id === requestedJob)
        ? requestedJob ?? testJobOptions[0]?.id ?? ""
        : testJobOptions[0]?.id ?? ""
      : "",
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "All">("All");
  const [openedApplicationId, setOpenedApplicationId] = useState<string | null>(
    null,
  );
  const [statusNotice, setStatusNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isTestMode || !user?.id) return;

    let active = true;
    apiRequest<{ jobs: EmployerApiJob[] }>("/employer/jobs")
      .then(({ jobs }) => {
        if (!active) return;
        const nextJobs = jobs.map((job) => ({
          applications: 0,
          id: job.id,
          title: job.title,
        }));
        setServerJobs(nextJobs);
        setSelectedJob((current) => {
          if (nextJobs.some((job) => job.id === current)) return current;
          if (requestedJob && nextJobs.some((job) => job.id === requestedJob)) {
            return requestedJob;
          }
          return nextJobs[0]?.id ?? "";
        });
      })
      .catch((error) => {
        if (!active) return;
        setServerJobs([]);
        setSelectedJob("");
        setStatusNotice({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "JobFinder could not load your job posts.",
        });
      });

    return () => {
      active = false;
    };
  }, [isTestMode, requestedJob, user?.id]);

  useEffect(() => {
    if (isTestMode || !selectedJob) return;

    let active = true;
    setServerCandidates([]);
    setOpenedApplicationId(null);
    apiRequest<{
      applications: EmployerApiApplication[];
      job: EmployerApiJob;
    }>(`/employer/jobs/${encodeURIComponent(selectedJob)}/applications`)
      .then(({ applications, job }) => {
        if (!active) return;
        setServerCandidates(
          applications.map((application) =>
            apiApplicationToCandidate(application, job.title),
          ),
        );
        setServerJobs((current) =>
          current.map((item) =>
            item.id === selectedJob
              ? { ...item, applications: applications.length }
              : item,
          ),
        );
      })
      .catch((error) => {
        if (!active) return;
        setServerCandidates([]);
        setStatusNotice({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "JobFinder could not load applications for this job.",
        });
      });

    return () => {
      active = false;
    };
  }, [isTestMode, selectedJob]);

  const [statuses, setStatuses] = usePersistentState<
    Record<string, ReviewStatus>
  >(
    userStorageKey(CANDIDATE_STATUSES_STORAGE_KEY, user?.id),
    Object.fromEntries(
      isDemoEmployer
        ? Object.entries(candidatesByJob).flatMap(
            ([jobId, jobCandidates]) =>
              jobCandidates.map((candidate) => [
                `${jobId}:${candidate.id}`,
                candidate.initialStatus,
              ]),
          )
        : [],
    ),
  );
  const currentCandidates = useMemo(() => {
    if (!isTestMode) return serverCandidates;

    const submitted = submittedCandidatesByJob[selectedJob] ?? [];
    const submittedIds = new Set(submitted.map((candidate) => candidate.id));
    return [
      ...submitted,
      ...(isDemoEmployer
        ? (candidatesByJob[selectedJob] ?? []).filter(
            (candidate) => !submittedIds.has(candidate.id),
          )
        : []),
    ];
  }, [isDemoEmployer, isTestMode, selectedJob, serverCandidates, submittedCandidatesByJob]);

  const visibleCandidates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return [...currentCandidates]
      .filter((candidate) => {
        const status = isTestMode
          ? statuses[`${selectedJob}:${candidate.id}`] ??
            candidate.initialStatus
          : candidate.initialStatus;
        const matchesStatus =
          statusFilter === "All" || status === statusFilter;
        const matchesQuery =
          !normalizedQuery ||
          candidate.name.toLowerCase().includes(normalizedQuery) ||
          candidate.role.toLowerCase().includes(normalizedQuery) ||
          [...candidate.exactSkills, ...candidate.missingSkills].some((skill) =>
            skill.toLowerCase().includes(normalizedQuery),
          );

        return matchesStatus && matchesQuery;
      })
      .sort((first, second) => {
        const firstScore = first.hasMatch === false ? -1 : first.overallScore;
        const secondScore = second.hasMatch === false ? -1 : second.overallScore;
        return secondScore - firstScore;
      });
  }, [currentCandidates, isTestMode, query, selectedJob, statusFilter, statuses]);

  const currentJob =
    jobOptions.find((job) => job.id === selectedJob) ?? jobOptions[0];

  async function updateStatus(candidateId: string, status: ReviewStatus) {
    if (!isTestMode) {
      try {
        await apiRequest(`/employer/applications/${candidateId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: apiStatusFromReview(status) }),
        });
        setServerCandidates((current) =>
          current.map((candidate) =>
            candidate.id === candidateId
              ? { ...candidate, initialStatus: status }
              : candidate,
          ),
        );
        setStatusNotice({
          kind: "success",
          message: `Status saved as ${status}. The applicant can now see this update.`,
        });
      } catch (error) {
        setStatusNotice({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "JobFinder could not update this application.",
        });
      }
      return;
    }

    const submittedApplication = submittedApplications.find(
      (application) =>
        application.id === candidateId &&
        application.jobId === selectedJob,
    );

    if (
      submittedApplication &&
      !writeApplicationReviewStatus({
        version: 1,
        applicationId: submittedApplication.id,
        jobId: submittedApplication.jobId,
        applicantAccountId: submittedApplication.applicantAccountId,
        recipientEmployerId: submittedApplication.recipientEmployerId,
        status,
        updatedAt: new Date().toISOString(),
      })
    ) {
      setStatusNotice({
        kind: "error",
        message:
          "The status was updated, but this device could not refresh its local copy.",
      });
      return;
    }

    setStatuses((current) => ({
      ...current,
      [`${selectedJob}:${candidateId}`]: status,
    }));
    setStatusNotice({
      kind: "success",
      message: submittedApplication
        ? `Status saved as ${status}. The applicant can now see this update.`
        : `Status saved as ${status}.`,
    });
  }

  if (!currentJob) {
    return (
      <div className="page candidate-matches-page">
        <Link className="back-link" to="/employer">
          <ArrowLeft size={18} aria-hidden="true" />
          Back to Employer Overview
        </Link>
        <header className="page-header page-header--split">
          <div className="page-header__copy">
        <span className="eyebrow">Candidate Matching</span>
        <h1>Review Applicants with Clear Evidence</h1>
            <p>
              Candidates will appear here after you publish a direct job post
              and receive applications.
            </p>
          </div>
        </header>
        <section className="empty-state">
          <span className="empty-state__icon">
            <BriefcaseBusiness aria-hidden="true" />
          </span>
          <h2>No Job Posts to Review</h2>
          <p>Create your first direct listing to start receiving candidates.</p>
          <Link className="button button--primary" to="/employer/posts/new">
            Create Job Post
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page candidate-matches-page">
      <Link className="back-link" to="/employer">
        <ArrowLeft size={18} aria-hidden="true" />
        Back to Employer Overview
      </Link>

      <header className="page-header page-header--split">
        <div className="page-header__copy">
          <span className="eyebrow">Candidate Matching</span>
          <h1>Review Applicants with Clear Evidence</h1>
          <p>
            Skills count for 70% and location evidence for 30%.
            <br />
            Scores support people reviewing applications; they never decide
            who is hired.
          </p>
        </div>
        <Link className="button button--secondary" to="/employer/posts/new">
          Create Another Post
        </Link>
      </header>

      <section className="candidate-controls surface" aria-labelledby="candidate-job-heading">
        <div className="surface__body">
          <div className="candidate-job-picker">
            <label className="field" htmlFor="candidate-job">
              <span className="field-label" id="candidate-job-heading">
                Job post
              </span>
              <span className="candidate-select-wrap">
                <select
                  className="select"
                  id="candidate-job"
                  onChange={(event) => setSelectedJob(event.target.value)}
                  value={selectedJob}
                >
                  {jobOptions.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} · {job.applications} applicants
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" />
              </span>
            </label>
            <details className="candidate-ranking-summary">
              <summary>
                <Sparkles aria-hidden="true" />
                <span>
          <strong>How Ranking Works</strong>
                  Skills 70% · location 30% · human review required
                </span>
              </summary>
              <div className="candidate-formula" aria-label="Ranking formula">
                <Info aria-hidden="true" />
                <span>
            <strong>Formula Used for Ordering</strong>
                  FinalScore = SkillScore × 0.70 + LocationScore × 0.30
                </span>
              </div>
            </details>
          </div>
        </div>
      </section>

      <div className="candidate-toolbar">
        <label className="search-input-wrap candidate-search">
          <span className="sr-only">Search name, role, or skill</span>
          <Search aria-hidden="true" />
          <input
            className="input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, role, or skill"
            type="search"
            value={query}
          />
        </label>
        <label className="sort-field candidate-status-filter">
          <Filter aria-hidden="true" />
          <span>Status</span>
          <select
            onChange={(event) =>
              setStatusFilter(event.target.value as ReviewStatus | "All")
            }
            value={statusFilter}
          >
            <option value="All">All</option>
            <option value="New">New</option>
            <option value="Reviewing">Reviewing</option>
            <option value="Shortlisted">Shortlisted</option>
            <option value="Not selected">Not selected</option>
          </select>
        </label>
      </div>

      <div aria-live="polite">
        {statusNotice ? (
          <p
            className={`alert ${
              statusNotice.kind === "error"
                ? "alert--danger"
                : "alert--success"
            }`}
            role={statusNotice.kind === "error" ? "alert" : "status"}
          >
            {statusNotice.message}
          </p>
        ) : null}
      </div>

      <div className="results-heading candidate-results-heading">
        <div>
          <p className="kicker">{currentJob.title}</p>
          <h2>
            {visibleCandidates.length}{" "}
            {visibleCandidates.length === 1 ? "applicant" : "applicants"}
          </h2>
        </div>
      </div>

      {visibleCandidates.length ? (
        <ol className="candidate-list" aria-label="Ranked candidate matches">
          {visibleCandidates.map((candidate, index) => {
            const status = isTestMode
              ? statuses[`${selectedJob}:${candidate.id}`] ??
                candidate.initialStatus
              : candidate.initialStatus;

            return (
              <li key={candidate.id}>
                <article className="candidate-card surface">
                  <div className="candidate-card__summary">
                    <span className="candidate-rank" aria-label={`Rank ${index + 1}`}>
                      {index + 1}
                    </span>
                    <span className="candidate-avatar" aria-hidden="true">
                      <UserRound />
                    </span>
                    <div className="candidate-card__identity">
                      <div className="cluster">
                        <h3>{candidate.name}</h3>
                        <span className={statusClass(status)}>{status}</span>
                      </div>
                      <p>
                        {candidate.role} · applied{" "}
                        {formatAppliedDate(candidate.appliedAt)}
                      </p>
                    </div>
                    {candidate.hasMatch === false ? (
                      <div className="candidate-overall-score candidate-overall-score--unavailable">
                        <strong>No Score</strong>
                        <span>profile incomplete</span>
                      </div>
                    ) : (
                      <div className="candidate-overall-score">
                        <strong>{candidate.overallScore}%</strong>
                        <span>overall match</span>
                      </div>
                    )}
                  </div>

                  {candidate.hasMatch === false ? (
                    <p className="candidate-match-unavailable">
                      Match percentages will appear after the applicant completes
                      their profile.
                    </p>
                  ) : (
                    <div className="candidate-score-strip">
                    <div>
                      <span>Skills match</span>
                      <strong>{candidate.skillScore}%</strong>
                      <div
                        className="progress-track"
                        role="progressbar"
                        aria-label={`${candidate.name} skill score`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={candidate.skillScore}
                      >
                        <div
                          className="progress-value"
                          style={{ width: `${candidate.skillScore}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <span>Location match</span>
                      <strong>{candidate.locationScore}%</strong>
                      <div
                        className="progress-track"
                        role="progressbar"
                        aria-label={`${candidate.name} location score`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={candidate.locationScore}
                      >
                        <div
                          className="progress-value"
                          style={{ width: `${candidate.locationScore}%` }}
                        />
                      </div>
                    </div>
                    </div>
                  )}

                  <p className="candidate-card__reason">
                    {candidate.summary}
                  </p>

                  <details className="candidate-evidence">
                    <summary>
                      <span>
                        <Info aria-hidden="true" />
                        View Why This Applicant Matches
                      </span>
                      <ChevronDown aria-hidden="true" />
                    </summary>
                    <div className="candidate-evidence__grid">
                      <section aria-labelledby={`${candidate.id}-skills`}>
                          <h4 id={`${candidate.id}-skills`}>Skill Evidence</h4>
                        <ul className="candidate-skill-evidence">
                          {candidate.exactSkills.map((skill) => (
                            <li key={`exact-${skill}`}>
                              <span className="skill-status skill-status--exact">
                                Exact
                              </span>
                              <span>{skill}</span>
                            </li>
                          ))}
                          {candidate.relatedSkills.map((skill) => (
                            <li key={`related-${skill.candidate}`}>
                              <span className="skill-status skill-status--related">
                                Related
                              </span>
                              <span>
                                {skill.candidate}
                                <small>
                                  Supports required skill: {skill.required}
                                </small>
                              </span>
                            </li>
                          ))}
                          {candidate.missingSkills.map((skill) => (
                            <li key={`missing-${skill}`}>
                              <span className="skill-status skill-status--missing">
                                Missing
                              </span>
                              <span>{skill}</span>
                            </li>
                          ))}
                        </ul>
                      </section>

                      <section aria-labelledby={`${candidate.id}-location`}>
                          <h4 id={`${candidate.id}-location`}>Location Evidence</h4>
                        <dl className="candidate-location-evidence">
                          <div>
                            <dt>Estimated distance</dt>
                            <dd>
                              <MapPin aria-hidden="true" />
                              {candidate.distance}
                            </dd>
                          </div>
                        </dl>
                        <p className="field-hint">
                          Employers see the distance evidence used for
                          matching, not the candidate&apos;s exact home
                          address.
                        </p>
                      </section>
                    </div>

                    <footer className="candidate-card__actions">
                      <label className="field candidate-status-field">
                        <span className="field-label">Review status</span>
                        <select
                          className="select"
                          onChange={(event) =>
                            updateStatus(
                              candidate.id,
                              event.target.value as ReviewStatus,
                            )
                          }
                          value={status}
                        >
                          <option>New</option>
                          <option>Reviewing</option>
                          <option>Shortlisted</option>
                          <option>Not selected</option>
                        </select>
                      </label>
                      <button
                        aria-expanded={openedApplicationId === candidate.id}
                        className="button button--secondary"
                        onClick={() =>
                          setOpenedApplicationId((current) =>
                            current === candidate.id ? null : candidate.id,
                          )
                        }
                        type="button"
                      >
                        <FileText aria-hidden="true" />
                        {openedApplicationId === candidate.id
                                ? "Close Application"
                                : "View Application"}
                      </button>
                    </footer>
                    {openedApplicationId === candidate.id ? (
                      <section
                        aria-label={`${candidate.name} application summary`}
                        className="candidate-application-panel"
                      >
                        <div>
                        <p className="kicker">Application Summary</p>
                          <h4>{candidate.name}</h4>
                          <p>
                            Applied for {currentJob.title} with experience as{" "}
                            {candidate.role}.
                          </p>
                        </div>
                        <dl>
                          <div>
                            <dt>Resume</dt>
                            <dd>
                              {candidate.application?.resumeAvailable ? (
                                <a
                                  href={`/api/applications/${encodeURIComponent(candidate.id)}/resume`}
                                >
                                  {candidate.application.resumeName}
                                </a>
                              ) : (
                                candidate.application?.resumeName ??
                                `${candidate.name
                                  .replace(/\s+/g, "-")
                                  .toLowerCase()}-resume.pdf`
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt>Message</dt>
                            <dd>
                              {candidate.application?.message ||
                                "I am interested in this role and would welcome the opportunity to discuss my relevant experience."}
                            </dd>
                          </div>
                          {candidate.application ? (
                            <>
                              <div>
                                <dt>Email</dt>
                                <dd>
                                  <a
                                    href={`mailto:${candidate.application.email}`}
                                  >
                                    {candidate.application.email}
                                  </a>
                                </dd>
                              </div>
                              <div>
                                <dt>Mobile</dt>
                                <dd>{candidate.application.mobile}</dd>
                              </div>
                            </>
                          ) : null}
                        </dl>
                        <p className="field-hint">
                          Contact details are shown only for applications
                          submitted to this employer.
                        </p>
                      </section>
                    ) : null}
                  </details>
                </article>
              </li>
            );
          })}
        </ol>
      ) : (
        <section className="empty-state">
          <span className="empty-state__icon">
            <Search aria-hidden="true" />
          </span>
          <h2>
            {currentCandidates.length
              ? "No Candidates Match These Filters"
              : "No Applications Yet"}
          </h2>
          <p>
            {currentCandidates.length
              ? "Clear the search or choose a different review status."
              : "Candidates will appear here after they apply to this job post."}
          </p>
          {currentCandidates.length ? (
            <button
              className="button button--secondary"
              onClick={() => {
                setQuery("");
                setStatusFilter("All");
              }}
              type="button"
            >
              Clear filters
            </button>
          ) : (
            <Link className="button button--secondary" to="/employer">
                Return to Overview
            </Link>
          )}
        </section>
      )}

      <aside className="notice candidate-ranking-note">
        <Info aria-hidden="true" />
        <p>
          Ranking is decision support, not an automatic hiring rule. Review
          every application fairly and do not infer protected personal
          characteristics from skill or location data.
        </p>
      </aside>
      <div className="cluster cluster--end">
        <Link className="button button--secondary" to="/employer/posts/new">
          <BriefcaseBusiness aria-hidden="true" />
          Create Another Post
        </Link>
      </div>
    </div>
  );
}
