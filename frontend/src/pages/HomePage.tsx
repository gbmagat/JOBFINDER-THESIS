import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Compass,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  SUBMITTED_APPLICATIONS_STORAGE_KEY,
  type StoredSubmittedApplication,
} from "../features/applications/storage-contract";
import { useAuth } from "../features/auth/AuthContext";
import { useJobs } from "../features/jobs/JobsContext";
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
import { userStorageKey } from "../lib/storage-keys";
import { usePersistentState } from "../lib/usePersistentState";
import { apiRequest } from "../lib/api";

type HomeApiProfile = {
  isComplete: boolean;
  fullName: string;
  mobileNumber: string;
  barangay: string;
  city: string;
  maximumDistanceKm: number;
  maximumMinutes: number;
  preferredWorkTypes: string[];
  skills: { name: string }[];
};

const DEFAULT_HOME_WORK_TYPES = ["Full-time", "Hybrid"];

function hasRequiredProfileDetails(profile: typeof DEFAULT_PROFILE_DETAILS) {
  const mobileNumber = profile.mobileNumber.replace(/[\s()-]/g, "");
  return (
    profile.fullName.trim().length >= 2 &&
    /^(?:\+639|09)\d{9}$/.test(mobileNumber) &&
    Boolean(profile.barangay.trim()) &&
    Boolean(profile.city.trim()) &&
    Number(profile.maximumDistance) > 0 &&
    Number(profile.maximumMinutes) > 0
  );
}

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
  const { hasPersonalizedMatches, jobs: allJobs } = useJobs();
  const [query, setQuery] = useState("");
  const [profileDetails, setProfileDetails] = usePersistentState(
    userStorageKey(PROFILE_DETAILS_KEY, userId),
    DEFAULT_PROFILE_DETAILS,
  );
  const [commuteMinutes, setCommuteMinutes] = usePersistentState(
    userStorageKey(COMMUTE_MINUTES_KEY, userId),
    "35",
  );
  const [profileSkills, setProfileSkills] = usePersistentState<string[]>(
    userStorageKey(PROFILE_SKILLS_KEY, userId),
    DEFAULT_PROFILE_SKILLS,
  );
  const [preferredWorkTypes, setPreferredWorkTypes] = useState<string[] | null>(
    import.meta.env.MODE === "test" ? DEFAULT_HOME_WORK_TYPES : null,
  );
  const [savedJobIds, setSavedJobIds] = usePersistentState<string[]>(
    userStorageKey(SAVED_JOB_IDS_KEY, userId),
    DEFAULT_SAVED_JOB_IDS,
  );
  const [submittedApplications] = usePersistentState<
    StoredSubmittedApplication[]
  >(
    userStorageKey(SUBMITTED_APPLICATIONS_STORAGE_KEY, userId),
    [],
  );
  const [serverApplicationCount, setServerApplicationCount] = useState<
    number | null
  >(null);
  const [serverProfileComplete, setServerProfileComplete] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    if (import.meta.env.MODE === "test") return;

    let active = true;
    Promise.all([
      apiRequest<{ jobs: { id: string }[] }>("/saved-jobs"),
      apiRequest<{ applications: unknown[] }>("/applications"),
      apiRequest<{ profile: HomeApiProfile }>("/profile"),
    ])
      .then(([saved, submitted, { profile }]) => {
        if (!active) return;
        setSavedJobIds(saved.jobs.map((job) => job.id));
        setServerApplicationCount(submitted.applications.length);
        setProfileDetails({
          fullName: profile.fullName,
          mobileNumber: profile.mobileNumber,
          barangay: profile.barangay,
          city: profile.city,
          maximumDistance: String(profile.maximumDistanceKm),
          maximumMinutes: String(profile.maximumMinutes),
        });
        setCommuteMinutes(String(profile.maximumMinutes));
        setProfileSkills(profile.skills.map((skill) => skill.name));
        setPreferredWorkTypes(profile.preferredWorkTypes);
        setServerProfileComplete(profile.isComplete);
      })
      .catch(() => {
        if (active) {
          setPreferredWorkTypes(DEFAULT_HOME_WORK_TYPES);
          setServerProfileComplete(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    setCommuteMinutes,
    setProfileDetails,
    setProfileSkills,
    setSavedJobIds,
    userId,
  ]);
  const hasProfileDetails = hasRequiredProfileDetails(profileDetails);
  const canShowPersonalizedMatch =
    hasPersonalizedMatches &&
    (import.meta.env.MODE === "test"
      ? hasProfileDetails && profileSkills.length > 0
      : serverProfileComplete === true);
  const strongMatchCount = canShowPersonalizedMatch
    ? allJobs.filter(
        (job) =>
          job.fit.overallScore >= 85 &&
          job.route.estimatedMinutes <= Number(commuteMinutes),
      ).length
    : 0;
  const profileSetupHref =
    hasProfileDetails && profileSkills.length === 0
      ? "/onboarding/skills"
      : "/onboarding/profile";
  const activeApplicationCount =
    serverApplicationCount ?? submittedApplications.length;
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
            {canShowPersonalizedMatch
              ? `${profileDetails.barangay}, ${profileDetails.city}`
              : "Complete Your Profile to Unlock Matches"}
          </span>
          <h1>Good Morning, {firstName}</h1>
          <p>
            {canShowPersonalizedMatch
              ? "Find work that fits your skills and commute."
              : "Browse local jobs now, then complete your profile for personalized matches."}
          </p>
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
          <span>Strong Matches</span>
          <strong>{canShowPersonalizedMatch ? strongMatchCount : "—"}</strong>
          <small>
            {canShowPersonalizedMatch
              ? "Within your commute limit"
              : "Complete your profile to see matches"}
          </small>
        </article>
        <article className="dashboard-stat">
          <span>Saved Jobs</span>
          <strong>{savedJobIds.length}</strong>
          <small>Ready to revisit</small>
        </article>
        <Link className="dashboard-stat" to="/applications">
          <span>Active Applications</span>
          <strong>{activeApplicationCount}</strong>
          <small>
            {activeApplicationCount
              ? "Track your submitted applications"
              : "No active applications yet"}
          </small>
        </Link>
      </section>

      <div className="dashboard-content">
        <section className="dashboard-matches" aria-labelledby="matches-heading">
          <div className="section-heading">
            <div>
              <p className="kicker">Skill-aware and commute-aware</p>
              <h2 id="matches-heading">
                {canShowPersonalizedMatch ? "Best Matches" : "Explore Local Jobs"}
              </h2>
            </div>
            <Link className="text-link" to="/jobs">
              {canShowPersonalizedMatch ? "See All Matches" : "Browse All Jobs"}{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="job-list">
            {allJobs.slice(0, 2).map((job, index) => (
              <JobCard
                job={job}
                key={job.id}
                showMatch={canShowPersonalizedMatch}
                showSummary={index === 0}
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
              <p className="kicker">Personalized ranking</p>
              <h2 id="preferences-heading">Your Matching Preferences</h2>
              <dl>
                <div>
                  <dt>Commute limit</dt>
                  <dd>{commuteMinutes} minutes</dd>
                </div>
                <div>
                  <dt>Preferred work types</dt>
                  <dd>
                    {preferredWorkTypes === null
                      ? "Loading preferences..."
                      : preferredWorkTypes.length > 0
                        ? preferredWorkTypes.map((workType) => (
                            <span className="chip" key={workType}>
                              {workType}
                            </span>
                          ))
                        : "No preference selected"}
                  </dd>
                </div>
                <div>
                  <dt>Top skills</dt>
                  <dd>{profileSkills.join(" · ")}</dd>
                </div>
              </dl>
              <Link className="button button--secondary" to="/preferences">
                Edit Preferences
              </Link>
            </>
          ) : (
            <>
              <p className="kicker">Profile setup</p>
              <h2 id="preferences-heading">Unlock Personalized Matches</h2>
              <p className="preferences-card__message">
                Add your contact details, home area, commute limit, and skills
                before JobFinder calculates match percentages.
              </p>
              <Link className="button button--primary" to={profileSetupHref}>
                {profileSkills.length > 0
                  ? "Complete Your Profile"
                  : "Set Up Your Profile"}
              </Link>
            </>
          )}
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
    <div className="public-home">
      <section className="public-home-hero" aria-labelledby="home-heading">
        <div className="public-home-hero__inner">
          <div className="public-home-hero__copy">
            <p className="public-home-eyebrow">
              Angeles City Job Opportunities
            </p>
            <h1 id="home-heading">Welcome to JobFinder</h1>
            <p className="public-home-hero__lede">
              Browse local jobs or open the Employer Workspace. No account is
              needed until you apply.
            </p>

            <label
              className="public-home-search-label"
              htmlFor="home-job-search"
            >
              Quick Job Search
            </label>
            <form
              className="public-home-search"
              role="search"
              onSubmit={handleSearch}
            >
              <Search size={20} aria-hidden="true" />
              <input
                id="home-job-search"
                type="search"
                placeholder="Enter a job title, skill, or employer"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button className="button button--primary" type="submit">
                Search Jobs
              </button>
            </form>

            <p className="public-home-browse-note">
              <Check size={16} aria-hidden="true" />
              No account needed to browse
            </p>
          </div>
        </div>
      </section>

      <section className="public-data-strip" aria-label="Job data source">
        <div className="public-data-strip__inner">
          <p>
            <ShieldCheck size={19} aria-hidden="true" />
            Listings use PESO and LGU employment datasets.
          </p>
          <Link to="/about/data-sources">
            About Our Data Sources <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="public-start" aria-labelledby="start-heading">
        <div className="public-start__inner">
          <div className="public-start__heading">
            <p className="kicker">Choose Where to Start</p>
            <h2 id="start-heading">Start Exploring JobFinder</h2>
          </div>

          <div className="public-start__grid">
            <Link className="public-start-card is-featured" to="/jobs">
              <div>
                <p className="kicker">For Job Seekers</p>
                <h3>Browse Local Jobs</h3>
                <p>View nearby openings before you sign in.</p>
              </div>
              <ArrowRight size={19} aria-hidden="true" />
            </Link>

            <Link className="public-start-card" to="/employer">
              <div>
                <p className="kicker">For Employers</p>
                <h3>Employer Workspace</h3>
                <p>Post jobs and review suitable applicants.</p>
              </div>
              <ArrowRight size={19} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
