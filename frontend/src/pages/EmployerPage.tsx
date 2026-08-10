import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  readEmployerApplications,
  readEmployerCandidateStatuses,
} from "../features/applications/submitted-storage";
import { useAuth } from "../features/auth/AuthContext";
import { isLuminaDemoEmployer } from "../features/employer/demo-workspace";
import { getJobById } from "../features/jobs/data";
import { readPublishedEmployerPosts } from "../features/jobs/employer-posts";
import { apiRequest } from "../lib/api";

type EmployerOverviewJob = {
  applicantCount: number;
  closingAt?: string;
  id: string;
  location: {
    barangay?: string;
    city?: string;
    venue?: string;
  };
  newApplicantCount: number;
  status: string;
  strongMatchCount: number;
  title: string;
};

type EmployerOverviewResponse = {
  jobs: EmployerOverviewJob[];
  metrics: {
    activePosts: number;
    applicants: number;
    newToReview: number;
    strongMatches: number;
  };
  recentActivity: {
    applicantName: string;
    id: string;
    jobId: string;
    jobTitle: string;
    overallScore: number | null;
    status: string;
    submittedAt: string;
  }[];
};

function formatJobLocation(job: EmployerOverviewJob) {
  return [job.location.barangay || job.location.venue, job.location.city]
    .filter(Boolean)
    .join(", ");
}

function formatJobStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function effectiveJobStatus(status: string, closingAt?: string) {
  if (
    status === "active" &&
    closingAt &&
    Number.isFinite(Date.parse(closingAt)) &&
    Date.parse(closingAt) <= Date.now()
  ) {
    return "Expired";
  }
  return formatJobStatus(status);
}

function formatClosingDate(closingAt?: string) {
  if (!closingAt) return "Not set";
  const value = new Date(closingAt);
  if (!Number.isFinite(value.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
  }).format(value);
}

const seededEmployerPosts = [
  {
    id: "it-support-assistant-lumina-tech",
    title: "IT Support Assistant",
    location: "Sto. Rosario, Angeles City",
    status: "Active",
    closingLabel: "24 Jul",
    applicants: 18,
    newApplicants: 5,
    strongMatches: 7,
  },
  {
    id: "direct-customer-service",
    title: "Customer Service Associate",
    location: "Balibago, Angeles City",
    status: "Active",
    closingLabel: "21 Jul",
    applicants: 26,
    newApplicants: 3,
    strongMatches: 11,
  },
  {
    id: "direct-junior-developer",
    title: "Junior Web Developer",
    location: "Clark Freeport Zone",
    status: "Draft",
    closingLabel: "Not published",
    applicants: 0,
    newApplicants: 0,
    strongMatches: 0,
  },
] as const;

const seededActivity = [
  {
    title: "Maria Santos applied",
    detail: "IT Support Assistant · 94% match",
    time: "18 minutes ago",
  },
  {
    title: "Carlo Dizon was shortlisted",
    detail: "Customer Service Associate",
    time: "2 hours ago",
  },
  {
    title: "IT Support Assistant reached 18 applications",
    detail: "Review candidates with clear evidence.",
    time: "Yesterday",
  },
] as const;

export function EmployerPage() {
  const { user } = useAuth();
  const usesTestData = import.meta.env.MODE === "test";
  const isDemoEmployer = isLuminaDemoEmployer(user?.id);
  const [overview, setOverview] = useState<EmployerOverviewResponse | null>(
    null,
  );

  useEffect(() => {
    if (usesTestData || !user?.id) return;

    let isActive = true;
    setOverview(null);
    apiRequest<EmployerOverviewResponse>("/employer/overview")
      .then((result) => {
        if (isActive) setOverview(result);
      })
      .catch(() => {
        if (isActive) setOverview(null);
      });

    return () => {
      isActive = false;
    };
  }, [user?.id, usesTestData]);

  const submittedApplications = useMemo(
    () => readEmployerApplications(user?.id),
    [user?.id],
  );
  const localEmployerPosts = useMemo(() => {
    if (!usesTestData) return [];

    const candidateStatuses = readEmployerCandidateStatuses(user?.id);
    const submittedCounts = submittedApplications.reduce<
      Record<
        string,
        { applicants: number; newApplicants: number; strongMatches: number }
      >
    >((counts, application) => {
      const current = counts[application.jobId] ?? {
        applicants: 0,
        newApplicants: 0,
        strongMatches: 0,
      };
      const reviewStatus =
        candidateStatuses[`${application.jobId}:${application.id}`] ?? "New";
      const matchScore = getJobById(application.jobId)?.fit.overallScore ?? 0;

      counts[application.jobId] = {
        applicants: current.applicants + 1,
        newApplicants:
          current.newApplicants + (reviewStatus === "New" ? 1 : 0),
        strongMatches:
          current.strongMatches + (matchScore >= 85 ? 1 : 0),
      };
      return counts;
    }, {});
    const persistedPosts = readPublishedEmployerPosts(user?.id).map((post) => ({
      id: post.id,
      title: post.title,
      location: post.location,
      status: "Active" as const,
      closingLabel: new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
      }).format(new Date(`${post.deadline}T12:00:00+08:00`)),
      applicants: submittedCounts[post.id]?.applicants ?? 0,
      newApplicants: submittedCounts[post.id]?.newApplicants ?? 0,
      strongMatches: submittedCounts[post.id]?.strongMatches ?? 0,
    }));
    const persistedIds = new Set(persistedPosts.map((post) => post.id));
    const samplePosts = isDemoEmployer
      ? seededEmployerPosts
          .filter((post) => !persistedIds.has(post.id))
          .map((post) => ({
            ...post,
            applicants:
              post.applicants +
              (submittedCounts[post.id]?.applicants ?? 0),
            newApplicants:
              post.newApplicants +
              (submittedCounts[post.id]?.newApplicants ?? 0),
            strongMatches:
              post.strongMatches +
              (submittedCounts[post.id]?.strongMatches ?? 0),
          }))
      : [];

    return [...persistedPosts, ...samplePosts];
  }, [isDemoEmployer, submittedApplications, user?.id, usesTestData]);
  const employerPosts = useMemo(() => {
    if (usesTestData) return localEmployerPosts;
    if (!overview) return [];

    return overview.jobs.map((job) => {
      const status = effectiveJobStatus(job.status, job.closingAt);
      return {
        id: job.id,
        title: job.title,
        location: formatJobLocation(job),
        status,
        closingLabel:
          status === "Active"
            ? formatClosingDate(job.closingAt)
            : status === "Expired"
              ? `Closed ${formatClosingDate(job.closingAt)}`
              : "Not published",
        applicants: job.applicantCount,
        newApplicants: job.newApplicantCount,
        strongMatches: job.strongMatchCount,
      };
    });
  }, [localEmployerPosts, overview, usesTestData]);
  const activePostCount = overview
    ? overview.metrics.activePosts
    : employerPosts.filter((post) => post.status === "Active").length;
  const totalApplicants = overview
    ? overview.metrics.applicants
    : employerPosts.reduce((total, post) => total + post.applicants, 0);
  const newApplicants = overview
    ? overview.metrics.newToReview
    : employerPosts.reduce((total, post) => total + post.newApplicants, 0);
  const strongMatches = overview
    ? overview.metrics.strongMatches
    : employerPosts.reduce((total, post) => total + post.strongMatches, 0);
  const visibleActivity = usesTestData
    ? isDemoEmployer
      ? seededActivity
      : submittedApplications.slice(0, 3).map((application) => ({
        title: `${application.applicant.fullName} applied`,
        detail: application.jobTitle,
        time: new Intl.DateTimeFormat("en-PH", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(application.appliedAt)),
      }))
    : (overview?.recentActivity ?? []).map((application) => ({
        title: `${application.applicantName} applied`,
        detail: `${application.jobTitle}${
          application.overallScore === null
            ? ""
            : ` · ${application.overallScore}% match`
        }`,
        time: new Intl.DateTimeFormat("en-PH", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(application.submittedAt)),
      }));
  const workspaceName = usesTestData && isDemoEmployer
    ? "Lumina Tech"
    : user?.displayName || "your team";

  return (
    <div className="page employer-page">
      <header className="page-header page-header--split">
        <div className="page-header__copy">
          <span className="eyebrow">{workspaceName}</span>
          <h1>Employer Dashboard</h1>
        </div>
        <Link className="button button--primary" to="/employer/posts/new">
          Create Job Post
        </Link>
      </header>

      <section className="metric-grid employer-metrics" aria-label="Hiring summary">
        <article className="metric-card">
          <strong>{activePostCount}</strong>
          <span>Active posts</span>
        </article>
        <article className="metric-card">
          <strong>{totalApplicants}</strong>
          <span>Applicants</span>
        </article>
        <article className="metric-card">
          <strong>{newApplicants}</strong>
          <span>New to review</span>
        </article>
        <article className="metric-card">
          <strong>{strongMatches}</strong>
          <span>Strong matches</span>
        </article>
      </section>

      <div className="employer-dashboard-grid">
        <section className="surface employer-posts" aria-labelledby="posts-heading">
          <div className="surface__header">
            <div>
              <p className="kicker">Your job posts</p>
          <h2 id="posts-heading">Current Posts</h2>
            </div>
            <Link className="text-link" to="/employer/posts/new">
              New Post
            </Link>
          </div>

          <div
            className="applications-table-wrap"
            role="region"
            aria-label="Employer job posts"
            tabIndex={0}
          >
            <table className="applications-table employer-posts-table">
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Status</th>
                  <th scope="col">Applicants</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {employerPosts.length ? (
                  employerPosts.map((post) => (
                    <tr key={post.id}>
                    <td data-label="Job post">
                      <strong>{post.title}</strong>
                      <span>
                        {post.location.split(",")[0]}
                        {post.status === "Active"
                          ? ` · closes ${post.closingLabel}`
                          : ` · ${post.closingLabel}`}
                      </span>
                    </td>
                    <td data-label="Status">
                      <span
                        className={
                          post.status === "Active"
                            ? "badge badge--success"
                            : "badge badge--outline"
                        }
                      >
                        {post.status}
                      </span>
                    </td>
                    <td data-label="Applicants">
                      <strong>
                        {post.applicants}
                        {post.newApplicants > 0
                          ? ` · ${post.newApplicants} new`
                          : ""}
                      </strong>
                    </td>
                    <td data-label="Actions">
                      {post.status !== "Draft" ? (
                        <Link
                          className="button button--secondary"
                          to={`/employer/posts/${encodeURIComponent(post.id)}/candidates`}
                        >
                          View Applicants
                        </Link>
                      ) : (
                        <Link
                          className="button button--neutral"
                          to="/employer/posts/new"
                        >
                          Continue Draft
                        </Link>
                      )}
                    </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>
            <strong>No Job Posts Yet</strong>
                      <span>
                        Create your first direct listing to start receiving
                        applications.
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="surface employer-activity" aria-labelledby="activity-heading">
          <div className="surface__header">
            <div>
              <p className="kicker">Latest updates</p>
        <h2 id="activity-heading">Hiring Activity</h2>
            </div>
          </div>
          <ol className="employer-activity__list">
            {visibleActivity.length ? (
              visibleActivity.map((item) => (
                <li key={`${item.title}-${item.time}`}>
                  <span
                    className="employer-activity__marker"
                    aria-hidden="true"
                  />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                </li>
              ))
            ) : (
              <li>
                <span
                  className="employer-activity__marker"
                  aria-hidden="true"
                />
                <div>
              <strong>No Hiring Activity Yet</strong>
                  <p>New applications will appear here.</p>
                </div>
              </li>
            )}
          </ol>
        </aside>
      </div>

    </div>
  );
}
