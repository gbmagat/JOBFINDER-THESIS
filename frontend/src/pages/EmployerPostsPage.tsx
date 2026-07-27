import {
  BriefcaseBusiness,
  CalendarClock,
  MapPin,
  Plus,
  UsersRound,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { readEmployerApplications } from "../features/applications/submitted-storage";
import { useAuth } from "../features/auth/AuthContext";
import { isLuminaDemoEmployer } from "../features/employer/demo-workspace";
import { readPublishedEmployerPosts } from "../features/jobs/employer-posts";

const seededPosts = [
  {
    id: "it-support-assistant-lumina-tech",
    title: "IT Support Assistant",
    location: "Sto. Rosario, Angeles City",
    publishedAt: "2026-07-24T09:00:00+08:00",
    status: "Active",
    applicants: 18,
  },
  {
    id: "direct-customer-service",
    title: "Customer Service Associate",
    location: "Balibago, Angeles City",
    publishedAt: "2026-07-21T09:00:00+08:00",
    status: "Active",
    applicants: 26,
  },
] as const;

export function EmployerPostsPage() {
  const { user } = useAuth();
  const isDemoEmployer = isLuminaDemoEmployer(user?.id);
  const posts = useMemo(() => {
    const applicationCounts = readEmployerApplications(user?.id).reduce<
      Record<string, number>
    >((counts, application) => {
      counts[application.jobId] = (counts[application.jobId] ?? 0) + 1;
      return counts;
    }, {});
    const published = readPublishedEmployerPosts(user?.id).map((post) => ({
      id: post.id,
      title: post.title,
      location: post.location,
      publishedAt: post.publishedAt,
      status: "Active" as const,
      applicants: applicationCounts[post.id] ?? 0,
    }));
    const publishedIds = new Set(published.map((post) => post.id));
    return [
      ...published,
      ...(isDemoEmployer
        ? seededPosts
            .filter((post) => !publishedIds.has(post.id))
            .map((post) => ({
              ...post,
              applicants:
                post.applicants + (applicationCounts[post.id] ?? 0),
            }))
        : []),
    ];
  }, [isDemoEmployer, user?.id]);

  return (
    <div className="page employer-post-management">
      <header className="page-header page-header--split">
        <div className="page-header__copy">
          <span className="eyebrow">
            <BriefcaseBusiness size={16} aria-hidden="true" />
            Employer workspace
          </span>
          <h1>Job posts</h1>
          <p>
            Review direct listings, open their public page, and inspect
            applicants. PESO/LGU dataset records are not managed here.
          </p>
        </div>
        <Link className="button button--primary" to="/employer/posts/new">
          <Plus size={18} aria-hidden="true" />
          Create job post
        </Link>
      </header>

      <section className="surface" aria-labelledby="managed-posts-heading">
        <header className="surface__header">
          <div>
            <p className="kicker">Direct listings</p>
            <h2 id="managed-posts-heading">{posts.length} job posts</h2>
          </div>
          <span className="badge badge--success">Employer-owned</span>
        </header>
        <div
          className="applications-table-wrap"
          role="region"
          aria-label="Managed employer job posts"
          tabIndex={0}
        >
          <table className="applications-table employer-posts-table">
            <thead>
              <tr>
                <th scope="col">Job post</th>
                <th scope="col">Status</th>
                <th scope="col">Applicants</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.length ? (
                posts.map((post) => (
                  <tr key={post.id}>
                  <td data-label="Job post">
                    <strong>{post.title}</strong>
                    <span>
                      <MapPin size={13} aria-hidden="true" />
                      {post.location}
                    </span>
                    <span>
                      <CalendarClock size={13} aria-hidden="true" />
                      {new Intl.DateTimeFormat("en-PH", {
                        dateStyle: "medium",
                      }).format(new Date(post.publishedAt))}
                    </span>
                  </td>
                  <td data-label="Status">
                    <span className="badge badge--success">{post.status}</span>
                  </td>
                  <td data-label="Applicants">{post.applicants}</td>
                  <td data-label="Actions">
                    <div className="employer-post-toolbar">
                      <Link
                        className="button button--secondary"
                        to={`/employer/posts/${encodeURIComponent(post.id)}/candidates`}
                      >
                        <UsersRound size={16} aria-hidden="true" />
                        Candidates
                      </Link>
                      <Link
                        className="text-link"
                        to={`/jobs/${encodeURIComponent(post.id)}`}
                      >
                        Public page
                      </Link>
                    </div>
                  </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>
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
    </div>
  );
}

export default EmployerPostsPage;
