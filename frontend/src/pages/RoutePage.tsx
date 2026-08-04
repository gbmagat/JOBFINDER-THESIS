import {
  ArrowLeft,
  Bus,
  Footprints,
  Info,
  MapPin,
  Navigation,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useJobs } from "../features/jobs/JobsContext";
import type { RouteOption } from "../features/jobs/types";
import { JobMap } from "../features/maps/JobMap";
import { apiRequest } from "../lib/api";

const modeLabels = {
  walk: "Walking",
  motorcycle: "Motorcycle",
  drive: "Driving",
  "public-transport": "Public transport",
} as const;

export function RoutePage() {
  const { jobId = "" } = useParams();
  const { getJob, isLoading, loadJob } = useJobs();
  const job = getJob(jobId);
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
    if (!job) return;

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

  const route = routeResult?.route ?? null;
  return (
    <div className="page route-page">
      <Link className="back-link" to={`/jobs/${job.id}`}>
        <ArrowLeft size={18} aria-hidden="true" /> Back to Job Details
      </Link>

      <header className="page-header">
        <span className="eyebrow">
          <Navigation size={16} aria-hidden="true" />
          Graph route preview
        </span>
        <h1>Shortest Route to {job.employerName}</h1>
        <p>
          {routeResult
            ? `Starting area: ${routeResult.startingArea}. `
            : "JobFinder is selecting the available reference starting area. "}
          Destination: {job.location.venue}. This route can be viewed without
          signing in.
        </p>
      </header>

      {routeError ? (
        <aside className="notice notice--warning" role="alert">
          <Info size={20} aria-hidden="true" />
          <p>
            {routeError} JobFinder will not substitute a route that was not
            calculated by Dijkstra.
          </p>
        </aside>
      ) : null}

      {!route && !routeError ? (
        <section className="status-state" aria-live="polite">
          <h2>Calculating the Shortest Route</h2>
          <p>JobFinder is running Dijkstra on the available road graph.</p>
        </section>
      ) : null}

      {route ? (
        <div className="route-layout">
          <div className="route-main">
          <section className="route-map-card" aria-labelledby="route-map-title">
            <div className="route-map-card__heading">
              <div>
                <p className="kicker">Route distance</p>
                <h2 id="route-map-title">{route.distanceKm.toFixed(1)} km</h2>
              </div>
              <span className="source-pill">
                {modeLabels[route.mode]}
              </span>
            </div>
            <JobMap
              className="job-map-shell--route"
              label="OpenStreetMap displaying the route calculated by JobFinder Dijkstra"
              route={route}
              testId="route-map"
            />
            <div className="route-text-alternative">
              <strong>Route in Words</strong>
              <p>{route.textSummary}</p>
              {route.algorithm === "dijkstra" ? (
                <small>Calculated by JobFinder Dijkstra</small>
              ) : null}
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
                    {step.distanceKm ? (
                      <small>{step.distanceKm.toFixed(1)} km</small>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </section>
          </div>

          <aside className="route-sidebar">
          <section className="content-card">
            <h2>Route Summary</h2>
            <dl className="route-summary-list">
              <div>
                <dt>
                  <MapPin size={18} aria-hidden="true" /> Distance
                </dt>
                <dd>{route.distanceKm.toFixed(1)} km</dd>
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
                This is a graph-based reference route, not live navigation. Its
                line connects the available JobFinder nodes and may not follow
                every road bend. Confirm current local conditions before
                leaving.
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
      ) : null}
    </div>
  );
}
