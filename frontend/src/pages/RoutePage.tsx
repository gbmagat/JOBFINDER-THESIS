import {
  ArrowLeft,
  Bus,
  Clock3,
  Footprints,
  Info,
  MapPin,
  Navigation,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { useJobs } from "../features/jobs/JobsContext";
import type { RouteOption } from "../features/jobs/types";
import {
  DEFAULT_PROFILE_DETAILS,
  PROFILE_DETAILS_KEY,
} from "../features/profile/storage";
import { usePersistentState } from "../lib/usePersistentState";
import { userStorageKey } from "../lib/storage-keys";
import { apiRequest } from "../lib/api";

const modeLabels = {
  walk: "Walking",
  motorcycle: "Motorcycle",
  drive: "Driving",
  "public-transport": "Public transport",
} as const;

export function RoutePage() {
  const { user } = useAuth();
  const { jobId = "" } = useParams();
  const { getJob, isLoading, loadJob } = useJobs();
  const job = getJob(jobId);
  const [profileDetails] = usePersistentState(
    userStorageKey(PROFILE_DETAILS_KEY, user?.id),
    DEFAULT_PROFILE_DETAILS,
  );
  const [routeResult, setRouteResult] = useState<{
    personalized: boolean;
    route: RouteOption;
    startingArea: string;
  } | null>(null);
  const [routeError, setRouteError] = useState("");

  useEffect(() => {
    if (!job && !isLoading && jobId) void loadJob(jobId);
  }, [isLoading, job, jobId, loadJob]);

  useEffect(() => {
    if (!job || import.meta.env.MODE === "test") return;

    let active = true;
    setRouteResult(null);
    setRouteError("");
    apiRequest<{
      personalized: boolean;
      route: RouteOption;
      startingArea: string;
    }>(`/jobs/${encodeURIComponent(job.id)}/route`)
      .then((result) => {
        if (active) setRouteResult(result);
      })
      .catch((error) => {
        if (!active) return;
        setRouteError(
          error instanceof Error
            ? error.message
            : "JobFinder could not refresh this route.",
        );
      });

    return () => {
      active = false;
    };
  }, [job]);

  if (!job) {
    return (
      <div className="page route-page">
        <section className="empty-state">
          <h1>Route Unavailable</h1>
          <Link className="button button--primary" to="/jobs">
            Browse Jobs
          </Link>
        </section>
      </div>
    );
  }

  const route = routeResult?.route ?? job.route;
  const startingArea =
    routeResult?.startingArea ||
    `${profileDetails.barangay}, ${profileDetails.city}`;

  return (
    <div className="page route-page">
      <Link className="back-link" to={`/jobs/${job.id}`}>
        <ArrowLeft size={18} aria-hidden="true" /> Back to Job Details
      </Link>

      <header className="page-header">
        <span className="eyebrow">
          <Navigation size={16} aria-hidden="true" />
          Public route preview
        </span>
        <h1>Shortest Route to {job.employerName}</h1>
        <p>
          Starting area used for this estimate: {startingArea}. Destination:{" "}
          {job.location.venue}. No sign in is required to view this reference
          route.
        </p>
      </header>

      {routeError ? (
        <aside className="notice" role="status">
          <Info size={20} aria-hidden="true" />
          <p>
            {routeError} The listing&apos;s saved reference estimate is shown
            below.
          </p>
        </aside>
      ) : null}

      <div className="route-layout">
        <div className="route-main">
          <section className="route-map-card" aria-labelledby="route-map-title">
            <div className="route-map-card__heading">
              <div>
                <p className="kicker">Estimated route</p>
                <h2 id="route-map-title">
                  {route.distanceKm.toFixed(1)} km ·{" "}
                  {route.estimatedMinutes} minutes
                </h2>
              </div>
              <span className="source-pill">
                {modeLabels[route.mode]}
              </span>
            </div>
            <div className="route-map-visual" aria-hidden="true">
              <span className="route-map-visual__road route-map-visual__road--a" />
              <span className="route-map-visual__road route-map-visual__road--b" />
              <span className="route-map-visual__line" />
              <span className="route-map-visual__point route-map-visual__point--start">
                A
              </span>
              <span className="route-map-visual__point route-map-visual__point--end">
                B
              </span>
            </div>
            <div className="route-text-alternative">
              <strong>Route in Words</strong>
              <p>{route.textSummary}</p>
            </div>
          </section>

          <section className="content-card" aria-labelledby="directions-title">
            <p className="kicker">Step-by-step</p>
            <h2 id="directions-title">Directions</h2>
            <ol className="route-steps">
              {route.steps.map((step) => (
                <li key={step.order}>
                  <span className="route-steps__number">{step.order}</span>
                  <span>
                    <strong>{step.instruction}</strong>
                    {step.distanceKm || step.estimatedMinutes ? (
                      <small>
                        {step.distanceKm
                          ? `${step.distanceKm.toFixed(1)} km`
                          : ""}
                        {step.distanceKm && step.estimatedMinutes ? " · " : ""}
                        {step.estimatedMinutes
                          ? `${step.estimatedMinutes} min`
                          : ""}
                      </small>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="route-sidebar">
          <section className="content-card">
            <h2>Travel Summary</h2>
            <dl className="route-summary-list">
              <div>
                <dt>
                  <MapPin size={18} aria-hidden="true" /> Distance
                </dt>
                <dd>{route.distanceKm.toFixed(1)} km</dd>
              </div>
              <div>
                <dt>
                  <Clock3 size={18} aria-hidden="true" /> Travel time
                </dt>
                <dd>{route.estimatedMinutes} min</dd>
              </div>
              <div>
                <dt>
                  {route.mode === "walk" ? (
                    <Footprints size={18} aria-hidden="true" />
                  ) : (
                    <Bus size={18} aria-hidden="true" />
                  )}
                  Mode
                </dt>
                <dd>{modeLabels[route.mode]}</dd>
              </div>
              {route.estimatedFarePhp ? (
                <div>
                  <dt>
                    <WalletCards size={18} aria-hidden="true" /> Est. fare
                  </dt>
                  <dd>₱{route.estimatedFarePhp}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <aside className="notice">
            <Info size={20} aria-hidden="true" />
            <p>
              This is a reference estimate, not live navigation. Confirm
              current local road and transport conditions before leaving.
            </p>
          </aside>

          <Link
            className="button button--primary button--block"
            to={`/jobs/${job.id}`}
          >
            Return to Job
          </Link>
        </aside>
      </div>
    </div>
  );
}
