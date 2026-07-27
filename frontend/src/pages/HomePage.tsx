import { FormEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Check,
  Compass,
  Database,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import {
  SUBMITTED_APPLICATIONS_STORAGE_KEY,
  type StoredSubmittedApplication,
} from "../features/applications/storage-contract";
import { getAllJobs } from "../features/jobs/data";
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
} from "../features/profile/storage";
import { usePersistentState } from "../lib/usePersistentState";
import { userStorageKey } from "../lib/storage-keys";

const featureItems = [
  {
    icon: Sparkles,
    title: "Skills that mean the same thing",
    description:
      "See jobs that match related skills—not only the exact words in a listing.",
  },
  {
    icon: MapPin,
    title: "A commute you can understand",
    description:
      "Compare distance, estimated travel time, and a readable route before applying.",
  },
  {
    icon: Database,
    title: "Transparent local sources",
    description:
      "Know whether a listing came from an employer or a PESO/LGU dataset.",
  },
];

export function HomePage() {
  const { user } = useAuth();

  if (user?.role === "employer") {
    return <Navigate replace to="/employer" />;
  }

  if (user?.role === "job-seeker") {
    return <JobSeekerHome displayName={user.displayName} userId={user.id} />;
  }

  return <PublicHome />;
}

function JobSeekerHome({
  displayName,
  userId,
}: {
  displayName: string;
  userId: string;
}) {
  const navigate = useNavigate();
  const allJobs = useMemo(() => getAllJobs(), []);
  const [query, setQuery] = useState("");
  const [profileDetails] = usePersistentState(
    userStorageKey(PROFILE_DETAILS_KEY, userId),
    DEFAULT_PROFILE_DETAILS,
  );
  const [commuteMinutes] = usePersistentState(
    userStorageKey(COMMUTE_MINUTES_KEY, userId),
    "35",
  );
  const [profileSkills] = usePersistentState<string[]>(
    userStorageKey(PROFILE_SKILLS_KEY, userId),
    DEFAULT_PROFILE_SKILLS,
  );
  const [savedJobIds] = usePersistentState<string[]>(
    userStorageKey(SAVED_JOB_IDS_KEY, userId),
    DEFAULT_SAVED_JOB_IDS,
  );
  const [submittedApplications] = usePersistentState<
    StoredSubmittedApplication[]
  >(
    userStorageKey(SUBMITTED_APPLICATIONS_STORAGE_KEY, userId),
    [],
  );
  const strongMatchCount = allJobs.filter(
    (job) =>
      job.fit.overallScore >= 85 &&
      job.route.estimatedMinutes <= Number(commuteMinutes),
  ).length;
  const activeApplicationCount = 3 + submittedApplications.length;
  const firstName = displayName.trim().split(/\s+/, 1)[0] || "there";

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/jobs?q=${encodeURIComponent(value)}` : "/jobs");
  }

  return (
    <div className="page seeker-dashboard">
      <header className="dashboard-welcome">
        <div>
          <span className="eyebrow">
            <Compass size={16} aria-hidden="true" />
            {profileDetails.barangay}, {profileDetails.city}
          </span>
          <h1>Good morning, {firstName}</h1>
          <p>Find work that fits your skills and commute.</p>
        </div>

        <form
          className="search-bar dashboard-search"
          role="search"
          onSubmit={handleSearch}
        >
          <Search size={20} aria-hidden="true" />
          <label className="sr-only" htmlFor="dashboard-job-search">
            Search jobs, skills, or employers
          </label>
          <input
            id="dashboard-job-search"
            type="search"
            placeholder="Search jobs, skills, or employers"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="button button--primary" type="submit">
            Search
          </button>
        </form>
      </header>

      <section className="dashboard-stats" aria-label="Job seeker summary">
        <article className="dashboard-stat">
          <span>Strong matches</span>
          <strong>{strongMatchCount}</strong>
          <small>Within your commute limit</small>
        </article>
        <article className="dashboard-stat">
          <span>Saved jobs</span>
          <strong>{savedJobIds.length}</strong>
          <small>Ready to revisit</small>
        </article>
        <article className="dashboard-stat">
          <span>Active applications</span>
          <strong>{activeApplicationCount}</strong>
          <small>One shortlisted</small>
        </article>
      </section>

      <div className="dashboard-content">
        <section className="dashboard-matches" aria-labelledby="matches-heading">
          <div className="section-heading">
            <div>
              <p className="kicker">Skill-aware and commute-aware</p>
              <h2 id="matches-heading">Best matches</h2>
            </div>
            <Link className="text-link" to="/jobs">
              See all matches <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="job-list">
            {allJobs.slice(0, 2).map((job, index) => (
              <JobCard
                job={job}
                key={job.id}
                showSummary={index === 0}
              />
            ))}
          </div>
        </section>

        <aside
          className="preferences-card"
          aria-labelledby="preferences-heading"
        >
          <p className="kicker">Personalized ranking</p>
          <h2 id="preferences-heading">Your matching preferences</h2>
          <dl>
            <div>
              <dt>Commute limit</dt>
              <dd>{commuteMinutes} minutes</dd>
            </div>
            <div>
              <dt>Preferred work types</dt>
              <dd>
                <span className="chip">Full-time</span>
                <span className="chip">Hybrid</span>
              </dd>
            </div>
            <div>
              <dt>Top skills</dt>
              <dd>{profileSkills.join(" · ") || "Add skills to personalize"}</dd>
            </div>
          </dl>
          <Link className="button button--secondary" to="/preferences">
            Edit preferences
          </Link>
        </aside>
      </div>
    </div>
  );
}

function PublicHome() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/jobs?q=${encodeURIComponent(value)}` : "/jobs");
  }

  return (
    <>
      <section className="hero section" aria-labelledby="home-heading">
        <div className="hero__copy">
          <span className="eyebrow">
            <Compass size={16} aria-hidden="true" />
            Local opportunities in Angeles City
          </span>
          <h1 id="home-heading">Browse jobs freely.</h1>
          <p className="hero__lede">
            Search nearby work, view match reasons and routes—no login needed.
            Sign in only when you are ready to apply.
          </p>

          <form className="search-bar" role="search" onSubmit={handleSearch}>
            <Search size={20} aria-hidden="true" />
            <label className="sr-only" htmlFor="home-job-search">
              Search jobs, skills, or employers
            </label>
            <input
              id="home-job-search"
              type="search"
              placeholder="Search jobs, skills, or employers"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="button button--primary" type="submit">
              Search jobs
            </button>
          </form>

          <div className="trust-row" aria-label="What guests can do">
            <span>
              <Check size={16} aria-hidden="true" /> No account to browse
            </span>
            <span>
              <Check size={16} aria-hidden="true" /> Match reasons included
            </span>
            <span>
              <Check size={16} aria-hidden="true" /> Source shown clearly
            </span>
          </div>
        </div>

        <div className="hero__visual" aria-label="JobFinder match preview">
          <div className="preview-card">
            <div className="preview-card__top">
              <span className="icon-tile">
                <BriefcaseBusiness size={22} aria-hidden="true" />
              </span>
              <span className="match-badge">91% match</span>
            </div>
            <p className="kicker">Recommended near you</p>
            <h2>IT Support Assistant</h2>
            <p>Lumina Tech · Angeles City</p>
            <div className="preview-metrics">
              <div>
                <strong>95%</strong>
                <span>Skill fit</span>
              </div>
              <div>
                <strong>18 min</strong>
                <span>Est. commute</span>
              </div>
            </div>
            <p className="preview-card__reason">
              Your troubleshooting and networking skills are closely related
              to this role.
            </p>
            <Link
              className="text-link"
              to="/jobs/it-support-assistant-lumina-tech"
            >
              View public job details <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="start-heading">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Choose where to start</span>
            <h2 id="start-heading">Start exploring JobFinder</h2>
          </div>
          <span className="quiet-badge">No login needed to browse</span>
        </div>

        <div className="choice-grid">
          <article className="choice-card choice-card--featured">
            <span className="icon-tile">
              <Search size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="kicker">For job seekers</p>
              <h3>Browse local jobs</h3>
              <p>
                Discover skill-aware, commute-aware opportunities. Review
                match reasons, routes, and source details before you apply.
              </p>
              <div className="chip-row">
                <span className="chip">Semantic skill fit</span>
                <span className="chip">Commute-aware</span>
              </div>
            </div>
            <Link className="button button--primary" to="/jobs">
              Browse jobs—no sign in <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </article>

          <article className="choice-card">
            <span className="icon-tile icon-tile--soft">
              <Building2 size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="kicker">For employers</p>
              <h3>Employer workspace</h3>
              <p>
                Sign in to post jobs, manage direct listings, and review
                suitable candidates.
              </p>
            </div>
            <Link className="button button--secondary" to="/employer">
              Sign in as employer <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </article>
        </div>
      </section>

      <section className="section section--tinted" aria-labelledby="why-heading">
        <div className="section-heading section-heading--centered">
          <div>
            <span className="eyebrow">Clear evidence, practical choices</span>
            <h2 id="why-heading">Why a job is recommended</h2>
            <p>
              JobFinder explains its skill and location evidence so you can
              decide for yourself.
            </p>
          </div>
        </div>
        <div className="feature-grid">
          {featureItems.map(({ icon: Icon, title, description }) => (
            <article className="feature-card" key={title}>
              <span className="icon-tile icon-tile--soft">
                <Icon size={22} aria-hidden="true" />
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
