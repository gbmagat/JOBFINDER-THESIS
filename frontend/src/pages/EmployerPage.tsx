import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Database,
  Eye,
  MapPin,
  Plus,
  UsersRound,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  readEmployerApplications,
  readEmployerCandidateStatuses,
} from "../features/applications/submitted-storage";
import { useAuth } from "../features/auth/AuthContext";
import { isLuminaDemoEmployer } from "../features/employer/demo-workspace";
import { getJobById } from "../features/jobs/data";
import { readPublishedEmployerPosts } from "../features/jobs/employer-posts";

const seededEmployerPosts = [
  {
    id: "it-support-assistant-lumina-tech",
    title: "IT Support Assistant",
    location: "Sto. Rosario, Angeles City",
    status: "Active",
    posted: "July 24, 2026",
    applicants: 18,
    newApplicants: 5,
    strongMatches: 7,
  },
  {
    id: "direct-customer-service",
    title: "Customer Service Associate",
    location: "Balibago, Angeles City",
    status: "Active",
    posted: "July 21, 2026",
    applicants: 26,
    newApplicants: 3,
    strongMatches: 11,
  },
  {
    id: "direct-junior-developer",
    title: "Junior Web Developer",
    location: "Clark Freeport Zone",
    status: "Draft",
    posted: "Not published",
    applicants: 0,
    newApplicants: 0,
    strongMatches: 0,
  },
] as const;

const seededActivity = [
  {
    title: "Maria Santos applied",
    detail: "IT Support Assistant · 94% overall match",
    time: "18 minutes ago",
  },
  {
    title: "Carlo Dizon was shortlisted",
    detail: "Customer Service Associate · 91% overall match",
    time: "2 hours ago",
  },
  {
    title: "IT Support Assistant reached 18 applications",
    detail: "7 candidates currently have an 85% or higher match",
    time: "Yesterday",
  },
] as const;

export function EmployerPage() {
  const { user } = useAuth();
  const isDemoEmployer = isLuminaDemoEmployer(user?.id);
  const submittedApplications = useMemo(
    () => readEmployerApplications(user?.id),
    [user?.id],
  );
  const employerPosts = useMemo(() => {
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
      posted: new Intl.DateTimeFormat("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date(post.publishedAt)),
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
  }, [isDemoEmployer, submittedApplications, user?.id]);
  const activePosts = employerPosts.filter((post) => post.status === "Active");
  const totalApplicants = employerPosts.reduce(
    (total, post) => total + post.applicants,
    0,
  );
  const newApplicants = employerPosts.reduce(
    (total, post) => total + post.newApplicants,
    0,
  );
  const strongMatches = employerPosts.reduce(
    (total, post) => total + post.strongMatches,
    0,
  );
  const visibleActivity = isDemoEmployer
    ? seededActivity
    : submittedApplications.slice(0, 3).map((application) => ({
        title: `${application.applicant.fullName} applied`,
        detail: application.jobTitle,
        time: new Intl.DateTimeFormat("en-PH", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(application.appliedAt)),
      }));
  const workspaceName = isDemoEmployer
    ? "Lumina Tech"
    : user?.displayName || "your team";

  return (
    <div className="page employer-page">
      <header className="page-header page-header--split">
        <div className="page-header__copy">
          <span className="eyebrow">Employer workspace</span>
          <h1>Good morning, {workspaceName}</h1>
          <p>
            Manage your direct job posts and review applicants ranked by skill
            fit and practical travel distance.
          </p>
        </div>
        <Link className="button button--primary" to="/employer/posts/new">
          <Plus size={18} aria-hidden="true" />
          Create job post
        </Link>
      </header>

      <nav className="employer-quick-nav" aria-label="Employer workspace">
        <Link className="employer-quick-nav__link is-active" to="/employer">
          Overview
        </Link>
        <Link className="employer-quick-nav__link" to="/employer/posts">
          Job posts
        </Link>
        <Link className="employer-quick-nav__link" to="/employer/candidates">
          Candidates
        </Link>
        <Link className="employer-quick-nav__link" to="/employer/company">
          Company profile
        </Link>
      </nav>

      <section className="metric-grid employer-metrics" aria-label="Hiring summary">
        <article className="metric-card">
          <BriefcaseBusiness aria-hidden="true" />
          <strong>{activePosts.length}</strong>
          <span>Active direct posts</span>
        </article>
        <article className="metric-card">
          <UsersRound aria-hidden="true" />
          <strong>{totalApplicants}</strong>
          <span>Total applicants</span>
        </article>
        <article className="metric-card">
          <CircleAlert aria-hidden="true" />
          <strong>{newApplicants}</strong>
          <span>New to review</span>
        </article>
        <article className="metric-card">
          <CheckCircle2 aria-hidden="true" />
          <strong>{strongMatches}</strong>
          <span>Strong matches</span>
        </article>
      </section>

      <div className="employer-dashboard-grid">
        <section className="surface employer-posts" aria-labelledby="posts-heading">
          <div className="surface__header">
            <div>
              <p className="kicker">Direct listings</p>
              <h2 id="posts-heading">Your job posts</h2>
            </div>
            <Link className="text-link" to="/employer/posts/new">
              New post
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
                  <th scope="col">Job post</th>
                  <th scope="col">Status</th>
                  <th scope="col">Applicants</th>
                  <th scope="col">Strong matches</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {employerPosts.length ? (
                  employerPosts.map((post) => (
                    <tr key={post.id}>
                    <td data-label="Job post">
                      <strong>{post.title}</strong>
                      <span>
                        <MapPin size={13} aria-hidden="true" />
                        {post.location}
                      </span>
                      <span>
                        <CalendarClock size={13} aria-hidden="true" />
                        {post.posted}
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
                      <strong>{post.applicants}</strong>
                      {post.newApplicants > 0 ? (
                        <span>{post.newApplicants} new</span>
                      ) : null}
                    </td>
                    <td data-label="Strong matches">
                      <strong>{post.strongMatches}</strong>
                      <span>85% or higher</span>
                    </td>
                    <td data-label="Actions">
                      {post.status === "Active" ? (
                        <Link
                          className="button button--secondary"
                          to={`/employer/posts/${encodeURIComponent(post.id)}/candidates`}
                        >
                          <UsersRound aria-hidden="true" />
                          View matches
                        </Link>
                      ) : (
                        <Link
                          className="button button--neutral"
                          to="/employer/posts/new"
                        >
                          Continue draft
                        </Link>
                      )}
                    </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <strong>No job posts yet</strong>
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
              <h2 id="activity-heading">Hiring activity</h2>
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
                    <time>{item.time}</time>
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
                  <strong>No hiring activity yet</strong>
                  <p>New applications will appear here.</p>
                </div>
              </li>
            )}
          </ol>
          <div className="surface__footer">
            <Link className="text-link" to="/employer/candidates">
              Review all candidates
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>

      <section className="employer-setup-grid" aria-label="Employer setup">
        <article className="content-card">
          <span className="icon-tile icon-tile--soft">
            <Building2 aria-hidden="true" />
          </span>
          <div>
            <p className="kicker">Company presence</p>
            <h2>Complete your company profile</h2>
            <p>
              Add a clear description, contact details, and workplace benefits
              so applicants know who they are applying to.
            </p>
          </div>
          <Link className="button button--secondary" to="/employer/company">
            Edit company profile
          </Link>
        </article>

        <article className="content-card employer-source-note">
          <span className="icon-tile icon-tile--soft">
            <Database aria-hidden="true" />
          </span>
          <div>
            <p className="kicker">Data boundary</p>
            <h2>PESO/LGU records stay read-only</h2>
            <p>
              This workspace manages only vacancies posted directly by your
              company. PESO and LGU organizations provide external datasets;
              they are not employer accounts or approval administrators.
            </p>
          </div>
          <Link className="text-link" to="/about/data-sources">
            <Eye size={16} aria-hidden="true" />
            Review data-source policy
          </Link>
        </article>
      </section>
    </div>
  );
}
