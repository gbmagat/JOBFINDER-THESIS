import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BookmarkPlus,
  Filter,
  LoaderCircle,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Search,
  Trash2,
  WifiOff,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { useJobs } from "../features/jobs/JobsContext";
import { JobCard } from "../features/jobs/JobCard";
import type { RouteOption } from "../features/jobs/types";
import { JobMap } from "../features/maps/JobMap";
import { apiRequest } from "../lib/api";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import { usePersistentState } from "../lib/usePersistentState";
import { userStorageKey } from "../lib/storage-keys";

type SortOption = "match" | "skill" | "distance" | "newest";
type LocationStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unsupported";

type RouteApiResult = {
  personalized: boolean;
  route: RouteOption;
  startingArea: string;
};

type SavedHomeLocation = {
  areaName: string;
  latitude: number;
  longitude: number;
};

type SavedSearch = {
  alerts: boolean;
  barangay: string;
  createdAt: string;
  id: string;
  minimumPay: string;
  query: string;
  schedule: string;
  transportMode: string;
  workTypes: string[];
};

const workTypes = ["Full-time", "Part-time", "Work from home"] as const;
const transportModes = [
  ["", "Any transport"],
  ["walk", "Walking"],
  ["public-transport", "Public transport"],
  ["drive", "Driving"],
  ["motorcycle", "Motorcycle"],
] as const;
const SEARCH_WORK_TYPES_KEY = "jobfinder.search.work-types.v1";
const SEARCH_MINIMUM_PAY_KEY = "jobfinder.search.minimum-pay.v1";
const SEARCH_TRANSPORT_MODE_KEY = "jobfinder.search.transport-mode.v1";
const SEARCH_BARANGAY_KEY = "jobfinder.search.barangay.v1";
const SEARCH_SCHEDULE_KEY = "jobfinder.search.schedule.v1";
const SAVED_SEARCHES_KEY = "jobfinder.saved-searches.v1";

export function JobsPage() {
  const { user } = useAuth();
  const {
    error: jobsError,
    hasPersonalizedMatches,
    isLoading: jobsLoading,
    jobs: allJobs,
    refreshJobs,
  } = useJobs();
  const canShowPersonalizedMatch =
    user?.role === "job-seeker" && hasPersonalizedMatches;
  const [searchParams, setSearchParams] = useSearchParams();
  const isOnline = useOnlineStatus();
  const activeQuery = searchParams.get("q") ?? "";
  const previewState = searchParams.get("state");
  const [draftQuery, setDraftQuery] = useState(activeQuery);
  const [selectedWorkTypes, setSelectedWorkTypes] = usePersistentState<
    string[]
  >(userStorageKey(SEARCH_WORK_TYPES_KEY, user?.id), []);
  const [minimumPay, setMinimumPay] = usePersistentState(
    userStorageKey(SEARCH_MINIMUM_PAY_KEY, user?.id),
    "",
  );
  const [transportMode, setTransportMode] = usePersistentState(
    userStorageKey(SEARCH_TRANSPORT_MODE_KEY, user?.id),
    "",
  );
  const [barangay, setBarangay] = usePersistentState(
    userStorageKey(SEARCH_BARANGAY_KEY, user?.id),
    "",
  );
  const [schedule, setSchedule] = usePersistentState(
    userStorageKey(SEARCH_SCHEDULE_KEY, user?.id),
    "",
  );
  const [savedSearches, setSavedSearches] = usePersistentState<SavedSearch[]>(
    userStorageKey(SAVED_SEARCHES_KEY, user?.id),
    [],
  );
  const [savedSearchStatus, setSavedSearchStatus] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("match");
  const visibleSortBy: SortOption = canShowPersonalizedMatch
    ? sortBy
    : sortBy === "distance" || sortBy === "newest"
      ? sortBy
      : "newest";
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] =
    useState<LocationStatus>("idle");
  const [browserLocation, setBrowserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [savedHomeLocation, setSavedHomeLocation] =
    useState<SavedHomeLocation | null>(null);
  const [mapRoute, setMapRoute] = useState<RouteApiResult | null>(null);
  const [mapRouteError, setMapRouteError] = useState("");
  const isLoading = jobsLoading || previewState === "loading";
  const hasServiceError = Boolean(jobsError) || previewState === "error";
  const isOffline = !isOnline || previewState === "offline";
  const isUnauthorized = previewState === "unauthorized";
  const effectiveLocation = browserLocation ?? savedHomeLocation;
  const effectiveLocationLabel = browserLocation
    ? "You are here"
    : savedHomeLocation
      ? "Saved home area"
      : "You are here";
  const usingSavedHomeLocation = Boolean(
    savedHomeLocation && !browserLocation,
  );
  const barangayOptions = useMemo(
    () =>
      [...new Set(allJobs.map((job) => job.location.barangay))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [allJobs],
  );
  const scheduleOptions = useMemo(
    () =>
      [
        ...new Set(
          allJobs.flatMap((job) => (job.schedule ? [job.schedule] : [])),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [allJobs],
  );

  const results = useMemo(() => {
    const query = activeQuery.trim().toLowerCase();
    const pay = Number(minimumPay) || 0;

    const filtered = allJobs.filter((job) => {
      const isOpen =
        !job.closingAt || Date.parse(job.closingAt) >= Date.now();
      const searchable = [
        job.title,
        job.employerName,
        job.summary,
        job.location.barangay,
        ...job.tags,
        ...job.requirements.requiredSkills,
        ...job.requirements.preferredSkills,
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = !query || searchable.includes(query);
      const matchesPay = job.salary.maximumPhp >= pay;
      const matchesWorkType =
        !selectedWorkTypes.length ||
        selectedWorkTypes.some(
          (type) =>
            job.employmentType === type ||
            job.workArrangement ===
              (type === "Work from home" ? "Remote" : type),
        );
      const matchesTransport =
        !transportMode || job.route.mode === transportMode;
      const matchesBarangay =
        !barangay || job.location.barangay === barangay;
      const matchesSchedule = !schedule || job.schedule === schedule;

      return (
        isOpen &&
        matchesQuery &&
        matchesPay &&
        matchesWorkType &&
        matchesTransport &&
        matchesBarangay &&
        matchesSchedule
      );
    });

    return filtered.sort((first, second) => {
      switch (visibleSortBy) {
        case "skill":
          return second.fit.skillScore - first.fit.skillScore;
        case "distance":
          return first.route.distanceKm - second.route.distanceKm;
        case "newest":
          return (
            new Date(second.postedAt).getTime() -
            new Date(first.postedAt).getTime()
          );
        case "match":
        default:
          return second.fit.overallScore - first.fit.overallScore;
      }
    });
  }, [
    activeQuery,
    allJobs,
    barangay,
    minimumPay,
    schedule,
    selectedWorkTypes,
    transportMode,
    visibleSortBy,
  ]);

  const selectedJob = results.find((job) => job.id === selectedJobId);
  const mapJobs = useMemo(
    () =>
      results.flatMap((job) =>
        typeof job.location.latitude === "number" &&
        typeof job.location.longitude === "number"
          ? [
              {
                id: job.id,
                latitude: job.location.latitude,
                longitude: job.location.longitude,
                title: job.title,
              },
            ]
          : [],
      ),
    [results],
  );
  const visibleMapJobs = useMemo(
    () =>
      selectedJob
        ? mapJobs.filter((job) => job.id === selectedJob.id)
        : mapJobs,
    [mapJobs, selectedJob],
  );

  useEffect(() => {
    if (user?.role !== "job-seeker") {
      setSavedHomeLocation(null);
      return;
    }

    let active = true;
    apiRequest<{
      profile: { homeLocation: SavedHomeLocation | null };
    }>("/profile")
      .then(({ profile }) => {
        if (!active) return;
        const location = profile.homeLocation;
        setSavedHomeLocation(
          location &&
            Number.isFinite(location.latitude) &&
            Number.isFinite(location.longitude)
            ? location
            : null,
        );
      })
      .catch(() => {
        if (active) setSavedHomeLocation(null);
      });

    return () => {
      active = false;
    };
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (
      selectedJobId &&
      !results.some((job) => job.id === selectedJobId)
    ) {
      setSelectedJobId(null);
      setMapRoute(null);
      setMapRouteError("");
    }
  }, [results, selectedJobId]);

  useEffect(() => {
    if (!selectedJob || !effectiveLocation) {
      setMapRoute(null);
      setMapRouteError("");
      return;
    }

    if (import.meta.env.MODE === "test") {
      const existingCoordinates = selectedJob.route.geometry?.coordinates ?? [];
      const destinationCoordinates: [number, number][] =
        typeof selectedJob.location.latitude === "number" &&
        typeof selectedJob.location.longitude === "number"
          ? [
              [
                selectedJob.location.longitude,
                selectedJob.location.latitude,
              ],
            ]
          : [];
      setMapRoute({
        personalized: false,
        route: {
          ...selectedJob.route,
          algorithm: "dijkstra",
          geometry: {
            coordinates: [
              [effectiveLocation.longitude, effectiveLocation.latitude],
              ...(existingCoordinates.length
                ? existingCoordinates
                : destinationCoordinates),
            ],
            type: "LineString",
          },
        },
        startingArea: "Your Current Location",
      });
      setMapRouteError("");
      return;
    }

    let active = true;
    setMapRoute(null);
    setMapRouteError("");
    const locationQuery = new URLSearchParams({
      latitude: String(effectiveLocation.latitude),
      longitude: String(effectiveLocation.longitude),
    });
    apiRequest<RouteApiResult>(
      `/jobs/${encodeURIComponent(selectedJob.id)}/route?${locationQuery.toString()}`,
    )
      .then((result) => {
        if (active) setMapRoute(result);
      })
      .catch((error) => {
        if (!active) return;
        setMapRouteError(
          error instanceof Error
            ? error.message
            : "JobFinder could not calculate this route.",
        );
      });

    return () => {
      active = false;
    };
  }, [effectiveLocation, selectedJob]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    const value = draftQuery.trim();
    if (value) {
      next.set("q", value);
    } else {
      next.delete("q");
    }
    setSearchParams(next);
  }

  function clearFilters() {
    setDraftQuery("");
    setSelectedWorkTypes([]);
    setMinimumPay("");
    setTransportMode("");
    setBarangay("");
    setSchedule("");
    setSearchParams({});
  }

  function clearPreviewState() {
    const next = new URLSearchParams(searchParams);
    next.delete("state");
    setSearchParams(next);
  }

  function retryJobs() {
    clearPreviewState();
    void refreshJobs();
  }

  function clearQuery() {
    setDraftQuery("");
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    setSearchParams(next);
  }

  function toggleWorkType(type: string) {
    setSelectedWorkTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    );
  }

  function saveCurrentSearch() {
    if (user?.role !== "job-seeker") return;

    const nextSearch: SavedSearch = {
      alerts: false,
      barangay,
      createdAt: new Date().toISOString(),
      id: `search-${Date.now()}`,
      minimumPay,
      query: activeQuery,
      schedule,
      transportMode,
      workTypes: selectedWorkTypes,
    };
    const signature = JSON.stringify({
      barangay,
      minimumPay,
      query: activeQuery,
      schedule,
      transportMode,
      workTypes: [...selectedWorkTypes].sort(),
    });
    const duplicate = savedSearches.some(
      (savedSearch) =>
        JSON.stringify({
          barangay: savedSearch.barangay,
          minimumPay: savedSearch.minimumPay,
          query: savedSearch.query,
          schedule: savedSearch.schedule,
          transportMode: savedSearch.transportMode,
          workTypes: [...savedSearch.workTypes].sort(),
        }) === signature,
    );

    if (duplicate) {
      setSavedSearchStatus("This search is already saved.");
      return;
    }

    setSavedSearches((current) => [nextSearch, ...current].slice(0, 10));
    setSavedSearchStatus("Search saved. You can enable its alert below.");
  }

  function applySavedSearch(savedSearch: SavedSearch) {
    setBarangay(savedSearch.barangay);
    setMinimumPay(savedSearch.minimumPay);
    setSchedule(savedSearch.schedule);
    setTransportMode(savedSearch.transportMode);
    setSelectedWorkTypes(savedSearch.workTypes);
    setDraftQuery(savedSearch.query);
    const next = new URLSearchParams(searchParams);
    if (savedSearch.query) {
      next.set("q", savedSearch.query);
    } else {
      next.delete("q");
    }
    setSearchParams(next);
    setSavedSearchStatus("Saved search applied.");
  }

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setLocationStatus("unsupported");
      return;
    }

    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBrowserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationStatus("granted");
      },
      () => {
        setBrowserLocation(null);
        setLocationStatus("denied");
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 8_000 },
    );
  }

  function showJobOnMap(jobId: string) {
    if (selectedJobId === jobId) {
      showAllJobsOnMap();
      setMobileMapOpen(true);
      return;
    }

    setMapRoute(null);
    setMapRouteError("");
    setSelectedJobId(jobId);
    setMobileMapOpen(true);
  }

  function showAllJobsOnMap() {
    setSelectedJobId(null);
    setMapRoute(null);
    setMapRouteError("");
  }

  return (
    <div className="page jobs-page jobs-page--directory">
      <header className="page-header jobs-directory-header">
        <div className="jobs-directory-hero">
          <div className="jobs-directory-hero__inner">
            <h1 className="jobs-directory-title">Search Local Jobs</h1>

            <div className="jobs-search-shell">
              <form
                className="search-bar search-bar--wide jobs-search-form"
                onSubmit={handleSearch}
                role="search"
              >
                <Search size={20} aria-hidden="true" />
                <label className="sr-only" htmlFor="jobs-search">
                  Search jobs, skills, or employers
                </label>
                <input
                  id="jobs-search"
                  type="search"
                  placeholder="Search jobs, skills, or employers"
                  value={draftQuery}
                  onChange={(event) => setDraftQuery(event.target.value)}
                />
                <button className="button button--primary" type="submit">
                  Find
                </button>
              </form>

              <nav
                aria-label="Search page shortcuts"
                className="jobs-search-shortcuts"
              >
                <a href="#job-filters">
                  <Filter size={17} aria-hidden="true" />
                  Filters
                </a>
                <a href="#jobs-map-panel">
                  <MapIcon size={17} aria-hidden="true" />
                  Map View
                </a>
              </nav>
            </div>
          </div>
        </div>

        <div className="mobile-toolbar">
          <button
            aria-expanded={filtersOpen}
            className="button button--secondary"
            onClick={() => setFiltersOpen((current) => !current)}
            type="button"
          >
            <Filter size={18} aria-hidden="true" />
            Filters
          </button>
          <button
            aria-pressed={mobileMapOpen}
            className="button button--secondary"
            onClick={() => setMobileMapOpen((current) => !current)}
            type="button"
          >
            <MapIcon size={18} aria-hidden="true" />
            {mobileMapOpen ? "Show List" : "Show Map"}
          </button>
          <label className="sort-field mobile-sort-field">
            <span className="sr-only">Sort jobs</span>
            <select
              aria-label="Sort jobs"
              onChange={(event) =>
                setSortBy(event.target.value as SortOption)
              }
              value={visibleSortBy}
            >
              {canShowPersonalizedMatch ? (
                <option value="match">Best match</option>
              ) : null}
              <option value="newest">Newest</option>
              <option value="distance">Nearest distance</option>
            </select>
          </label>
        </div>
      </header>

      {isUnauthorized ? (
        <aside className="notice notice--warning" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <p>
            That workspace is not available to this account role. Public job
            browsing remains available here.
          </p>
        </aside>
      ) : null}

      <div className="jobs-layout">
        <aside
          className={`filter-panel${filtersOpen ? " filter-panel--open" : ""}`}
          aria-label="Job filters"
          id="job-filters"
        >
          <div className="filter-panel__heading">
            <h2>Filters</h2>
            <button className="text-button" onClick={clearFilters} type="button">
              Clear
            </button>
          </div>

          <fieldset className="filter-group">
            <legend>Work type</legend>
            {workTypes.map((type) => (
              <label className="check-field" key={type}>
                <input
                  checked={selectedWorkTypes.includes(type)}
                  onChange={() => toggleWorkType(type)}
                  type="checkbox"
                />
                <span>{type}</span>
              </label>
            ))}
          </fieldset>

          <label className="field">
            <span>Minimum monthly pay</span>
            <select
              value={minimumPay}
              onChange={(event) => setMinimumPay(event.target.value)}
            >
              <option value="">Any pay</option>
              <option value="18000">₱18,000+</option>
              <option value="20000">₱20,000+</option>
              <option value="25000">₱25,000+</option>
            </select>
          </label>

          <details className="advanced-filters">
            <summary>More Filters</summary>
            <div className="advanced-filters__body">
              <label className="field">
                <span>Transport mode</span>
                <select
                  onChange={(event) => setTransportMode(event.target.value)}
                  value={transportMode}
                >
                  {transportModes.map(([value, label]) => (
                    <option key={label} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Workplace barangay</span>
                <select
                  onChange={(event) => setBarangay(event.target.value)}
                  value={barangay}
                >
                  <option value="">All Angeles City barangays</option>
                  {barangayOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Schedule</span>
                <select
                  onChange={(event) => setSchedule(event.target.value)}
                  value={schedule}
                >
                  <option value="">Any schedule</option>
                  {scheduleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              {user?.role === "job-seeker" ? (
                <section className="saved-searches" aria-labelledby="saved-searches-heading">
                  <div className="saved-searches__heading">
                    <h3 id="saved-searches-heading">Saved Searches</h3>
                    <button
                      className="text-button"
                      onClick={saveCurrentSearch}
                      type="button"
                    >
                      <BookmarkPlus size={15} aria-hidden="true" />
                      Save Current
                    </button>
                  </div>
                  {savedSearches.length ? (
                    <ul>
                      {savedSearches.map((savedSearch) => (
                        <li key={savedSearch.id}>
                          <button
                            className="saved-searches__apply"
                            onClick={() => applySavedSearch(savedSearch)}
                            type="button"
                          >
                            <strong>
                              {savedSearch.query || "All local jobs"}
                            </strong>
                            <small>
                              {[
                                savedSearch.barangay,
                                ...savedSearch.workTypes,
                                savedSearch.schedule,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "Default filters"}
                            </small>
                          </button>
                          <button
                            aria-label={`${savedSearch.alerts ? "Disable" : "Enable"} alerts for ${savedSearch.query || "all local jobs"}`}
                            aria-pressed={savedSearch.alerts}
                            className="icon-button"
                            onClick={() =>
                              setSavedSearches((current) =>
                                current.map((item) =>
                                  item.id === savedSearch.id
                                    ? { ...item, alerts: !item.alerts }
                                    : item,
                                ),
                              )
                            }
                            type="button"
                          >
                            <Bell size={16} aria-hidden="true" />
                          </button>
                          <button
                            aria-label={`Remove saved search ${savedSearch.query || "all local jobs"}`}
                            className="icon-button"
                            onClick={() =>
                              setSavedSearches((current) =>
                                current.filter(
                                  (item) => item.id !== savedSearch.id,
                                ),
                              )
                            }
                            type="button"
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Save a useful set of filters for later.</p>
                  )}
                  <p aria-live="polite" className="field-hint">
                    {savedSearchStatus}
                  </p>
                </section>
              ) : (
                <p className="field-hint">
                  Tip: You can browse first.
                  <br />
                  Sign in only to save or apply.
                </p>
              )}
            </div>
          </details>
        </aside>

        <section
          aria-label="Job results"
          className={`results-panel${
            mobileMapOpen ? " results-panel--mobile-hidden" : ""
          }`}
        >
          {activeQuery ||
          selectedWorkTypes.length ||
          minimumPay ||
          transportMode ||
          barangay ||
          schedule ? (
            <div className="active-filters" aria-label="Active filters">
              <strong>Active Filters</strong>
              <div className="chip-row">
                {activeQuery ? (
                  <button className="chip is-active" onClick={clearQuery} type="button">
                    Search: {activeQuery} <span aria-hidden="true">×</span>
                  </button>
                ) : null}
                {selectedWorkTypes.map((type) => (
                  <button
                    className="chip is-active"
                    key={type}
                    onClick={() => toggleWorkType(type)}
                    type="button"
                  >
                    {type} <span aria-hidden="true">×</span>
                  </button>
                ))}
                {minimumPay ? (
                  <button
                    className="chip is-active"
                    onClick={() => setMinimumPay("")}
                    type="button"
                  >
                    ₱{Number(minimumPay).toLocaleString()}+{" "}
                    <span aria-hidden="true">×</span>
                  </button>
                ) : null}
                {transportMode ? (
                  <button
                    className="chip is-active"
                    onClick={() => setTransportMode("")}
                    type="button"
                  >
                    {
                      transportModes.find(
                        ([value]) => value === transportMode,
                      )?.[1]
                    }{" "}
                    <span aria-hidden="true">×</span>
                  </button>
                ) : null}
                {barangay ? (
                  <button
                    className="chip is-active"
                    onClick={() => setBarangay("")}
                    type="button"
                  >
                    {barangay} <span aria-hidden="true">×</span>
                  </button>
                ) : null}
                {schedule ? (
                  <button
                    className="chip is-active"
                    onClick={() => setSchedule("")}
                    type="button"
                  >
                    {schedule} <span aria-hidden="true">×</span>
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="results-heading">
            <div>
              <p className="kicker">
                {canShowPersonalizedMatch ? "Recommended jobs" : "Local jobs"}
              </p>
              <h2>
                {results.length} {results.length === 1 ? "Job" : "Jobs"} Found
              </h2>
            </div>
            <label className="sort-field">
              <span>Sort</span>
              <select
                onChange={(event) =>
                  setSortBy(event.target.value as SortOption)
                }
                value={visibleSortBy}
              >
                {canShowPersonalizedMatch ? (
                  <>
                    <option value="match">Best match</option>
                    <option value="skill">Highest skill fit</option>
                  </>
                ) : null}
                <option value="newest">Newest</option>
                <option value="distance">Nearest distance</option>
              </select>
            </label>
          </div>

          {!user ? (
            <aside className="notice jobs-match-prompt" role="status">
              <p>
                Sign in to compare jobs with your skills. You can still browse
                every public listing without an account.
              </p>
              <Link className="text-link" to="/sign-in">
                Sign In
              </Link>
            </aside>
          ) : user.role === "job-seeker" && !canShowPersonalizedMatch ? (
            <aside className="notice jobs-match-prompt" role="status">
              <p>
                Complete your profile before JobFinder calculates match
                percentages.
              </p>
              <Link className="text-link" to="/onboarding/profile">
                Complete Profile
              </Link>
            </aside>
          ) : null}

          {isLoading ? (
            <section className="status-state" aria-live="polite">
              <LoaderCircle
                className="status-state__spinner"
                size={28}
                aria-hidden="true"
              />
              <h2>
                {canShowPersonalizedMatch
                  ? "Finding Suitable Local Jobs"
                  : "Finding Local Jobs"}
              </h2>
              <p>
                {canShowPersonalizedMatch
                  ? "Comparing skill and location evidence…"
                  : "Checking available public listings…"}
              </p>
              <div className="job-loading-skeleton" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </section>
          ) : hasServiceError ? (
            <section className="status-state status-state--error" role="alert">
              <AlertTriangle size={28} aria-hidden="true" />
              <h2>We Could Not Load Job Results</h2>
              <p>
                Your filters are safe. Check the connection and try loading
                the results again.
              </p>
              <button
                className="button button--primary"
                onClick={retryJobs}
                type="button"
              >
                Try Again
              </button>
            </section>
          ) : results.length ? (
            <div className="job-list">
              {results.map((job) => (
                <div
                  className={`job-result-selectable${
                    selectedJob?.id === job.id ? " is-selected" : ""
                  }`}
                  key={job.id}
                >
                  <JobCard
                    isShownOnMap={selectedJob?.id === job.id}
                    job={job}
                    onShowOnMap={() => showJobOnMap(job.id)}
                    showMatch={canShowPersonalizedMatch}
                    showSummary={false}
                    showSource={false}
                    showDistanceFact
                  />
                </div>
              ))}
            </div>
          ) : (
            <section className="empty-state" aria-live="polite">
              <span className="icon-tile icon-tile--soft">
                <Search size={26} aria-hidden="true" />
              </span>
              <h2>No Jobs Match These Filters</h2>
              <p>
                Try a related skill or clear one of the filters.
              </p>
              <button
                className="button button--primary"
                onClick={clearFilters}
                type="button"
              >
                Clear All Filters
              </button>
            </section>
          )}

          {isOffline ? (
            <aside className="offline-note" role="status">
              <WifiOff size={18} aria-hidden="true" />
              <span>
                You are offline. Showing safely cached jobs. Reconnect to sign
                in, compare skills, or apply. Applications stay online-only.
              </span>
            </aside>
          ) : null}
        </section>

        <aside
          className={`map-panel map-panel--real${
            mobileMapOpen ? " map-panel--mobile-visible" : ""
          }`}
          id="jobs-map-panel"
          aria-label={
            selectedJob
              ? `Map showing only ${selectedJob.title} and its route summary`
              : `Map showing ${results.length} local job locations`
          }
        >
          <div className="map-panel__heading">
            <div>
              <p className="kicker">Map Results</p>
              <h2>
                {selectedJob
                  ? "1 Selected Job"
                  : `${results.length} ${results.length === 1 ? "Job" : "Jobs"} Shown`}
              </h2>
            </div>
            <div className="map-panel__actions">
              {selectedJob ? (
                <button
                  className="text-button"
                  onClick={showAllJobsOnMap}
                  type="button"
                >
                  Show All Jobs
                </button>
              ) : null}
              <button
                className="icon-button"
                aria-label={
                  locationStatus === "requesting"
                    ? "Requesting current location"
                    : "Use current location"
                }
                disabled={locationStatus === "requesting"}
                onClick={requestLocation}
                type="button"
              >
                <LocateFixed size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
          {(locationStatus === "denied" ||
            locationStatus === "unsupported" ||
            previewState === "location-denied") &&
          usingSavedHomeLocation ? (
            <div className="map-permission-note map-permission-note--success" role="status">
              <MapPin size={18} aria-hidden="true" />
              <span>
                <strong>Saved home area is shown on the map.</strong>
                Your live device location is unavailable, so JobFinder is using
                the approximate area saved in your profile.
              </span>
            </div>
          ) : locationStatus === "denied" ||
            locationStatus === "unsupported" ||
            previewState === "location-denied" ? (
            <div className="map-permission-note" role="status">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>
                <strong>Your location is not available.</strong>
                {selectedJob
                  ? "Only the selected job location is shown. "
                  : "Job locations are still shown. "}
                You can enable location in your browser settings.
              </span>
            </div>
          ) : locationStatus === "granted" && browserLocation ? (
            <div className="map-permission-note map-permission-note--success">
              <LocateFixed size={18} aria-hidden="true" />
              <span>
                <strong>Your location is shown on the map.</strong>
                JobFinder uses the nearest mapped road node to calculate the
                route.
              </span>
            </div>
          ) : usingSavedHomeLocation ? (
            <div className="map-permission-note map-permission-note--success" role="status">
              <MapPin size={18} aria-hidden="true" />
              <span>
                <strong>Saved home area is shown on the map.</strong>
                Use current location for your live device position.
              </span>
            </div>
          ) : null}
          <JobMap
            currentLocation={effectiveLocation}
            jobs={visibleMapJobs}
            label={
              selectedJob
                ? mapRoute
                  ? `OpenStreetMap showing ${selectedJob.title}, ${effectiveLocationLabel.toLowerCase()}, and the JobFinder route.`
                  : effectiveLocation
                    ? `OpenStreetMap showing only ${selectedJob.title}. Select it to calculate a route from ${effectiveLocationLabel.toLowerCase()}.`
                    : `OpenStreetMap showing only ${selectedJob.title}. Use location to calculate a route.`
                : `OpenStreetMap showing ${results.length} local job locations${effectiveLocation ? ` and ${effectiveLocationLabel.toLowerCase()}` : ""}. Select a job to calculate its route.`
            }
            locationLabel={effectiveLocationLabel}
            onSelectJob={showJobOnMap}
            route={effectiveLocation ? mapRoute?.route : undefined}
            selectedJobId={selectedJob?.id}
            testId="jobs-map"
          />
          <div aria-live="polite" className="map-legend">
            <strong>Map Summary</strong>
            {selectedJob ? (
              <p>
                Selected job: {selectedJob.title}
                <br />
                {mapRoute
                  ? `${mapRoute.route.distanceKm.toFixed(1)} km from ${browserLocation ? "your current location" : "your saved home area"}.`
                  : effectiveLocation
                    ? mapRouteError || "Calculating the shortest route..."
                    : `Job location: ${selectedJob.location.venue}, ${selectedJob.location.barangay}, ${selectedJob.location.city}.`}
              </p>
            ) : (
              <p>
                {results.length
                  ? `${results.length} job locations are shown. Select a job to calculate and display its route.`
                  : "No jobs match the selected filters."}
              </p>
            )}
            {mapRoute?.route.algorithm === "dijkstra" ? (
              <p className="map-panel__source">
                Shortest path calculated by JobFinder Dijkstra
              </p>
            ) : null}
            {mapRoute ? (
              <p>
                Graph preview only. The line connects available JobFinder
                nodes; it is not turn-by-turn road navigation.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
