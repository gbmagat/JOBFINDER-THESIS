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

interface CurrentLocation {
  latitude: number;
  longitude: number;
}

type LocationState =
  | "idle"
  | "requesting"
  | "routing"
  | "ready"
  | "unavailable";

function isValidLocation(location: CurrentLocation) {
  return (
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

function locationErrorMessage(error: GeolocationPositionError) {
  if (error.code === 1) {
    return "Location permission was not granted. The map still shows the selected job.";
  }
  if (error.code === 2) {
    return "Your current location is unavailable. The map still shows the selected job.";
  }
  if (error.code === 3) {
    return "Finding your location took too long. The map still shows the selected job.";
  }
  return "JobFinder could not access your location. The map still shows the selected job.";
}

export function RoutePage() {
  const { jobId = "" } = useParams();
  const { getJob, isLoading, loadJob } = useJobs();
  const job = getJob(jobId);
  const [currentLocation, setCurrentLocation] =
    useState<CurrentLocation | null>(null);
  const [locationState, setLocationState] =
    useState<LocationState>("idle");
  const [route, setRoute] = useState<RouteOption | null>(null);
  const [routeError, setRouteError] = useState("");

  useEffect(() => {
    if (!job && !isLoading && jobId) void loadJob(jobId);
  }, [isLoading, job, jobId, loadJob]);

  useEffect(() => {
    setCurrentLocation(null);
    setLocationState("idle");
    setRoute(null);
    setRouteError("");
  }, [job?.id]);

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

  const hasJobCoordinates =
    typeof job.location.latitude === "number" &&
    typeof job.location.longitude === "number";
  const mapJobs = hasJobCoordinates
    ? [
        {
          id: job.id,
          latitude: job.location.latitude as number,
          longitude: job.location.longitude as number,
          title: job.title,
        },
      ]
    : [];
  const isLocating =
    locationState === "requesting" || locationState === "routing";

  const useCurrentLocation = () => {
    setRoute(null);
    setRouteError("");

    if (!("geolocation" in navigator) || !navigator.geolocation) {
      setCurrentLocation(null);
      setLocationState("unavailable");
      setRouteError(
        "Location is not supported by this browser. The map still shows the selected job.",
      );
      return;
    }

    setLocationState("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        if (!isValidLocation(location)) {
          setCurrentLocation(null);
          setLocationState("unavailable");
          setRouteError(
            "Your browser returned an invalid location. The map still shows the selected job.",
          );
          return;
        }

        setCurrentLocation(location);
        setLocationState("routing");
        const query = new URLSearchParams({
          latitude: String(location.latitude),
          longitude: String(location.longitude),
        });

        void apiRequest<{ route: RouteOption }>(
          `/jobs/${encodeURIComponent(job.id)}/route?${query.toString()}`,
        )
          .then((result) => {
            setRoute(result.route);
            setLocationState("ready");
          })
          .catch((error) => {
            setLocationState("unavailable");
            setRouteError(
              error instanceof Error
                ? `${error.message} The map still shows your location and the selected job.`
                : "JobFinder could not calculate this route. The map still shows your location and the selected job.",
            );
          });
      },
      (error) => {
        setCurrentLocation(null);
        setLocationState("unavailable");
        setRouteError(locationErrorMessage(error));
      },
      {
        enableHighAccuracy: false,
        maximumAge: 300_000,
        timeout: 10_000,
      },
    );
  };

  return (
    <div className="page route-page">
      <Link className="back-link" to={`/jobs/${job.id}`}>
        <ArrowLeft size={18} aria-hidden="true" /> Back to Job Details
      </Link>

      <header className="page-header">
        <span className="eyebrow">
          <Navigation size={16} aria-hidden="true" />
          Job location and route
        </span>
        <h1>Route to {job.employerName}</h1>
        <p>
          {route
            ? `JobFinder calculated a Dijkstra route from your browser location to ${job.location.venue}.`
            : `The map shows ${job.location.venue}. Use your location to calculate a JobFinder Dijkstra route.`}
        </p>
      </header>

      {routeError ? (
        <aside className="notice notice--warning" role="alert">
          <Info size={20} aria-hidden="true" />
          <p>{routeError}</p>
        </aside>
      ) : null}

      {locationState === "routing" ? (
        <section className="status-state" aria-live="polite">
          <h2>Calculating the Shortest Route</h2>
          <p>JobFinder is running Dijkstra on the available road graph.</p>
        </section>
      ) : null}

      <div className="route-layout">
        <div className="route-main">
          <section className="route-map-card" aria-labelledby="route-map-title">
            <div className="route-map-card__heading">
              <div>
                <p className="kicker">
                  {route ? "Route distance" : "Selected job location"}
                </p>
                <h2 id="route-map-title">
                  {route
                    ? `${route.distanceKm.toFixed(1)} km`
                    : job.location.barangay}
                </h2>
              </div>
              <span className="source-pill">
                {route ? modeLabels[route.mode] : job.location.city}
              </span>
            </div>
            <JobMap
              className="job-map-shell--route"
              currentLocation={currentLocation}
              jobs={mapJobs}
              label={
                route
                  ? "OpenStreetMap displaying your location, the selected job, and the route calculated by JobFinder Dijkstra"
                  : "OpenStreetMap displaying the selected job location"
              }
              route={route}
              selectedJobId={job.id}
              testId="route-map"
            />
            {route ? (
              <div className="route-text-alternative">
                <strong>Route in Words</strong>
                <p>{route.textSummary}</p>
                {route.algorithm === "dijkstra" ? (
                  <small>Calculated by JobFinder Dijkstra</small>
                ) : null}
              </div>
            ) : (
              <div className="route-text-alternative">
                <strong>{job.title}</strong>
                <p>
                  {job.location.venue}, {job.location.barangay},{" "}
                  {job.location.city}
                </p>
                <small>Your location has not been added to this map.</small>
              </div>
            )}
          </section>

          {route ? (
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
          ) : null}
        </div>

        <aside className="route-sidebar">
          {route ? (
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
          ) : (
            <section className="content-card">
              <h2>Route From Your Location</h2>
              <p>
                Share your location only when you want JobFinder to calculate
                this route. Without it, only the selected job is shown.
              </p>
              <button
                className="button button--primary button--block"
                disabled={isLocating}
                onClick={useCurrentLocation}
                type="button"
              >
                <Navigation size={18} aria-hidden="true" />
                {isLocating ? "Finding Your Location…" : "Use My Location"}
              </button>
            </section>
          )}

          {route ? (
            <aside className="notice">
              <Info size={20} aria-hidden="true" />
              <p>
                This is a graph-based route, not live navigation. Its line
                connects the available JobFinder nodes and may not follow every
                road bend. Confirm current local conditions before leaving.
              </p>
            </aside>
          ) : null}

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
