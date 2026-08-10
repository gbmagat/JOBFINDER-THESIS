import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  Compass,
  MapPin,
  Search,
  TrendingUp,
} from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { useJobs } from "../features/jobs/JobsContext";
import { JobCard } from "../features/jobs/JobCard";
import type { JobListing } from "../features/jobs/types";
import {
  DEFAULT_PROFILE_DETAILS,
  DEFAULT_PROFILE_SKILLS,
  PROFILE_DETAILS_KEY,
  PROFILE_SKILLS_KEY,
  WORK_TYPES_KEY,
} from "../features/profile/storage";
import { userStorageKey } from "../lib/storage-keys";
import { usePersistentState } from "../lib/usePersistentState";
import { apiRequest } from "../lib/api";

type HomeApiProfile = {
  isComplete: boolean;
  fullName: string;
  mobileNumber: string;
  barangay: string;
  city: string;
  preferredWorkTypes: string[];
  skills: { name: string }[];
};

function hasRequiredProfileDetails(profile: typeof DEFAULT_PROFILE_DETAILS) {
  const mobileNumber = profile.mobileNumber.replace(/[\s()-]/g, "");
  return (
    profile.fullName.trim().length >= 2 &&
    /^(?:\+639|09)\d{9}$/.test(mobileNumber) &&
    Boolean(profile.barangay.trim()) &&
    Boolean(profile.city.trim())
  );
}

export function HomePage() {
  const { user } = useAuth();

  if (user?.role === "employer") {
    return <Navigate replace to="/employer" />;
  }

  if (user?.role === "job-seeker") {
    return (
      <JobSeekerHome displayName={user.displayName} userId={user.id} />
    );
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
  const { hasPersonalizedMatches, jobs: allJobs } = useJobs();
  const [query, setQuery] = useState("");
  const [profileDetails, setProfileDetails] = usePersistentState(
    userStorageKey(PROFILE_DETAILS_KEY, userId),
    DEFAULT_PROFILE_DETAILS,
  );
  const [profileSkills, setProfileSkills] = usePersistentState<string[]>(
    userStorageKey(PROFILE_SKILLS_KEY, userId),
    DEFAULT_PROFILE_SKILLS,
  );
  const [preferredWorkTypes, setPreferredWorkTypes] = usePersistentState<
    string[]
  >(
    userStorageKey(WORK_TYPES_KEY, userId),
    [],
  );
  const [serverProfileComplete, setServerProfileComplete] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    if (import.meta.env.MODE === "test") return;

    let active = true;
    apiRequest<{ profile: HomeApiProfile }>("/profile")
      .then(({ profile }) => {
        if (!active) return;
        setProfileDetails({
          fullName: profile.fullName,
          mobileNumber: profile.mobileNumber,
          barangay: profile.barangay,
          city: profile.city,
        });
        setProfileSkills(profile.skills.map((skill) => skill.name));
        setPreferredWorkTypes(profile.preferredWorkTypes);
        setServerProfileComplete(profile.isComplete);
      })
      .catch(() => {
        if (active) {
          setServerProfileComplete(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    setProfileDetails,
    setProfileSkills,
    setPreferredWorkTypes,
    userId,
  ]);
  const hasProfileDetails = hasRequiredProfileDetails(profileDetails);
  const canShowPersonalizedMatch =
    hasPersonalizedMatches &&
    (import.meta.env.MODE === "test"
      ? hasProfileDetails && profileSkills.length > 0
      : serverProfileComplete === true);
  const profileName = profileDetails.fullName.trim() || displayName.trim();
  const firstName = profileName.split(/\s+/, 1)[0] || "you";
  const homeJobs = useMemo(() => {
    const jobs = canShowPersonalizedMatch
      ? [...allJobs].sort(
          (first, second) =>
            second.fit.overallScore - first.fit.overallScore,
        )
      : allJobs;
    return jobs.slice(0, 2);
  }, [allJobs, canShowPersonalizedMatch]);
  const profileSetupHref =
    hasProfileDetails && profileSkills.length === 0
      ? "/onboarding/skills"
      : "/onboarding/profile";
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
            {canShowPersonalizedMatch
              ? `${profileDetails.barangay}, ${profileDetails.city}`
              : "Profile incomplete"}
          </span>
          <h1>Jobs for {firstName}</h1>
        </div>

        <form
          className="search-bar dashboard-search"
          role="search"
          onSubmit={handleSearch}
        >
          <Search size={20} aria-hidden="true" />
          <label className="sr-only" htmlFor="dashboard-job-search">
            Search by job title, skill, or company
          </label>
          <input
            id="dashboard-job-search"
            type="search"
            placeholder="Job title, skill, or company"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="button button--primary" type="submit">
            Search
          </button>
        </form>
      </header>

      <div className="dashboard-content">
        <section className="dashboard-matches" aria-labelledby="matches-heading">
          <div className="section-heading">
            <div>
              <h2 id="matches-heading">
                {canShowPersonalizedMatch ? "Top matches" : "Local jobs"}
              </h2>
            </div>
            <Link className="text-link" to="/jobs">
              View all jobs{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="job-list home-job-grid">
            {homeJobs.map((job) => (
              <JobCard
                job={job}
                key={job.id}
                showMatch={canShowPersonalizedMatch}
                showMatchEvidence={canShowPersonalizedMatch}
                showSource={false}
                showSummary
              />
            ))}
          </div>
        </section>

        <aside
          className="preferences-card"
          aria-labelledby="preferences-heading"
        >
          {canShowPersonalizedMatch ? (
            <>
              <h2 id="preferences-heading">Your profile</h2>
              <dl>
                <div>
                  <dt>Location</dt>
                  <dd>
                    {profileDetails.barangay}, {profileDetails.city}
                  </dd>
                </div>
                <div>
                  <dt>Work types</dt>
                  <dd>
                    {preferredWorkTypes.length > 0
                      ? preferredWorkTypes.map((workType) => (
                          <span className="chip" key={workType}>
                            {workType}
                          </span>
                        ))
                      : "No preference selected"}
                  </dd>
                </div>
                <div>
                  <dt>Skills</dt>
                  <dd>{profileSkills.join(" · ")}</dd>
                </div>
              </dl>
              <Link className="button button--secondary" to="/preferences">
                Edit preferences
              </Link>
            </>
          ) : (
            <>
              <h2 id="preferences-heading">Complete your profile</h2>
              <p className="preferences-card__message">
                Add your location and skills to see match scores.
              </p>
              <Link className="button button--primary" to={profileSetupHref}>
                {profileSkills.length > 0
                  ? "Complete your profile"
                  : "Set up your profile"}
              </Link>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

const publicSalaryFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 0,
});

const publicJobCategories = [
  {
    label: "IT & Software",
    query: "IT software",
    terms: ["developer", "software", "web", "it support", "computer"],
  },
  {
    label: "Sales & Marketing",
    query: "sales marketing",
    terms: ["sales", "marketing"],
  },
  {
    label: "Customer Service",
    query: "customer service",
    terms: ["customer service", "customer support"],
  },
  {
    label: "Healthcare",
    query: "healthcare",
    terms: ["healthcare", "medical", "nurse"],
  },
  {
    label: "Accounting",
    query: "accounting",
    terms: ["accounting", "bookkeeping", "finance"],
  },
] as const;

function formatPublicSalary(job: JobListing) {
  return `\u20B1${publicSalaryFormatter.format(job.salary.minimumPhp)} - \u20B1${publicSalaryFormatter.format(job.salary.maximumPhp)}`;
}

function formatPublicPostedAge(postedAt: string) {
  const postedTime = new Date(postedAt).getTime();
  if (!Number.isFinite(postedTime)) return "Recently posted";

  const days = Math.max(
    0,
    Math.floor((Date.now() - postedTime) / (24 * 60 * 60 * 1000)),
  );
  if (days === 0) return "Today";
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function matchesPublicCategory(job: JobListing, terms: readonly string[]) {
  const searchableText = [
    job.title,
    job.summary,
    ...job.tags,
    ...job.requirements.requiredSkills,
    ...job.requirements.preferredSkills,
  ]
    .join(" ")
    .toLowerCase();

  return terms.some((term) => searchableText.includes(term));
}

function PublicHome() {
  const navigate = useNavigate();
  const { isLoading, jobs: allJobs } = useJobs();
  const [query, setQuery] = useState("");
  const featuredJobs = allJobs.slice(0, 4);
  const categoryCounts = useMemo(
    () =>
      publicJobCategories.map((category) => ({
        ...category,
        count: allJobs.filter((job) =>
          matchesPublicCategory(job, category.terms),
        ).length,
      })),
    [allJobs],
  );

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/jobs?q=${encodeURIComponent(value)}` : "/jobs");
  }

  return (
    <div className="public-home">
      <section className="public-home-hero" aria-labelledby="home-heading">
        <div className="public-home-hero__inner">
          <div className="public-home-hero__copy">
            <h1 id="home-heading">Find your next opportunity.</h1>
            <p className="public-home-hero__lede">
              Connect with local employers and discover roles that match your
              skills, experience, and career goals.
            </p>

            <form
              className="public-home-search"
              role="search"
              onSubmit={handleSearch}
            >
              <Search size={20} aria-hidden="true" />
              <label className="sr-only" htmlFor="home-job-search">
                Search by job title, skill, or company
              </label>
              <input
                id="home-job-search"
                type="search"
                placeholder="Job title, skills, or company"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button className="button button--primary" type="submit">
                Search
              </button>
            </form>

            <nav className="public-home-popular" aria-label="Popular searches">
              <span>Popular:</span>
              <Link to="/jobs?q=Software%20Engineer">Software Engineer</Link>
              <Link to="/jobs?q=Product%20Manager">Product Manager</Link>
              <Link to="/jobs?q=Data%20Analyst">Data Analyst</Link>
            </nav>
          </div>
        </div>
      </section>

      <section className="public-home-content" aria-labelledby="featured-heading">
        <div className="public-home-content__inner">
          <div className="public-featured-jobs">
            <div className="public-featured-jobs__heading">
              <h2 id="featured-heading">Featured Jobs for You</h2>
              <Link to="/jobs">
                View all <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>

            <div className="public-featured-jobs__list">
              {featuredJobs.map((job) => (
                <article
                  aria-labelledby={`public-home-job-${job.id}`}
                  className="public-job-card"
                  key={job.id}
                >
                  <div className="public-job-card__topline">
                    <span className="public-job-card__mark" aria-hidden="true">
                      <BriefcaseBusiness size={18} />
                    </span>
                    <time dateTime={job.postedAt}>
                      <Clock3 size={13} aria-hidden="true" />
                      {formatPublicPostedAge(job.postedAt)}
                    </time>
                  </div>

                  <div className="public-job-card__title-row">
                    <h3 id={`public-home-job-${job.id}`}>
                      <Link to={`/jobs/${encodeURIComponent(job.id)}`}>
                        {job.title}
                      </Link>
                    </h3>
                    {job.openingCount ? (
                      <span>
                        {job.openingCount} {job.openingCount === 1
                          ? "opening"
                          : "openings"}
                      </span>
                    ) : null}
                  </div>

                  <p className="public-job-card__employer">
                    {job.employerName}
                  </p>

                  <ul className="public-job-card__tags" aria-label="Job type">
                    <li>{job.workArrangement}</li>
                    <li>{job.employmentType}</li>
                    {job.tags.slice(0, 1).map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>

                  <p className="public-job-card__summary">{job.summary}</p>

                  <dl className="public-job-card__facts">
                    <div>
                      <dt className="sr-only">Location</dt>
                      <dd>
                        <MapPin size={14} aria-hidden="true" />
                        {job.location.city}, {job.location.province}
                      </dd>
                    </div>
                    <div>
                      <dt className="sr-only">Monthly salary</dt>
                      <dd>{formatPublicSalary(job)}</dd>
                    </div>
                  </dl>

                  <footer className="public-job-card__footer">
                    <Link
                      aria-label={`View details for ${job.title} at ${job.employerName}`}
                      to={`/jobs/${encodeURIComponent(job.id)}`}
                    >
                      View Details
                    </Link>
                  </footer>
                </article>
              ))}

              {isLoading && featuredJobs.length === 0 ? (
                <p className="public-featured-jobs__status" role="status">
                  Loading local jobs...
                </p>
              ) : null}
              {!isLoading && featuredJobs.length === 0 ? (
                <p className="public-featured-jobs__status">
                  No active local jobs are available right now.
                </p>
              ) : null}
            </div>
          </div>

          <aside className="public-home-sidebar" aria-label="Local job tools">
            <section className="public-sidebar-card public-local-insights">
              <h2>
                <TrendingUp size={17} aria-hidden="true" />
                Local Insights
              </h2>
              <p>
                JobFinder focuses on employment opportunities around Angeles
                City using local employment information.
              </p>
              <Link to="/about/data-sources">
                Read about our data
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </section>

            <section className="public-sidebar-card public-categories">
              <h2>Browse by Category</h2>
              <ul>
                {categoryCounts.map((category) => (
                  <li key={category.label}>
                    <Link to={`/jobs?q=${encodeURIComponent(category.query)}`}>
                      {category.label}
                    </Link>
                    <span aria-label={`${category.count} jobs`}>
                      {category.count}
                    </span>
                  </li>
                ))}
              </ul>
              <Link className="public-categories__all" to="/jobs">
                All Categories
              </Link>
            </section>

            <section className="public-profile-callout">
              <h2>Get discovered</h2>
              <p>
                Create your profile so employers can find the skills you bring.
              </p>
              <Link to="/register">
                Build your profile
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </section>
          </aside>
        </div>
      </section>
    </div>
  );
}
