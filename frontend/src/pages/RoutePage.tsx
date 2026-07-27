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
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { getJobById } from "../features/jobs/data";
import {
  DEFAULT_PROFILE_DETAILS,
  PROFILE_DETAILS_KEY,
} from "../features/profile/storage";
import { usePersistentState } from "../lib/usePersistentState";
import { userStorageKey } from "../lib/storage-keys";

const modeLabels = {
  walk: "Walking",
  motorcycle: "Motorcycle",
  drive: "Driving",
  "public-transport": "Public transport",
} as const;

export function RoutePage() {
  const { user } = useAuth();
  const { jobId = "" } = useParams();
  const job = getJobById(jobId);
  const [profileDetails] = usePersistentState(
    userStorageKey(PROFILE_DETAILS_KEY, user?.id),
    DEFAULT_PROFILE_DETAILS,
  );

  if (!job) {
    return (
      <section className="empty-state">
        <h1>Route unavailable</h1>
        <Link className="button button--primary" to="/jobs">
          Browse jobs
        </Link>
      </section>
    );
  }

  return (
    <div className="page route-page">
      <Link className="back-link" to={`/jobs/${job.id}`}>
        <ArrowLeft size={18} aria-hidden="true" /> Back to job details
      </Link>

      <header className="page-header">
        <span className="eyebrow">
          <Navigation size={16} aria-hidden="true" />
          Public route preview
        </span>
        <h1>Shortest route to {job.title}</h1>
        <p>
          Saved home area: {profileDetails.barangay}, {profileDetails.city}.
          Destination: {job.location.venue}. No sign in is required to view
          this reference route.
        </p>
      </header>

      {profileDetails.barangay.trim().toLowerCase() !== "balibago" ? (
        <aside className="notice" role="status">
          <Info size={20} aria-hidden="true" />
          <p>
            The figures below are the listing&apos;s reference estimate and
            have not been recalculated from {profileDetails.barangay}. A live
            routing service will replace them after backend integration.
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
                  {job.route.distanceKm.toFixed(1)} km ·{" "}
                  {job.route.estimatedMinutes} minutes
                </h2>
              </div>
              <span className="source-pill">
                {modeLabels[job.route.mode]}
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
              <strong>Route in words</strong>
              <p>{job.route.textSummary}</p>
            </div>
          </section>

          <section className="content-card" aria-labelledby="directions-title">
            <p className="kicker">Step-by-step</p>
            <h2 id="directions-title">Directions</h2>
            <ol className="route-steps">
              {job.route.steps.map((step) => (
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
            <h2>Route summary</h2>
            <dl className="route-summary-list">
              <div>
                <dt>
                  <MapPin size={18} aria-hidden="true" /> Distance
                </dt>
                <dd>{job.route.distanceKm.toFixed(1)} km</dd>
              </div>
              <div>
                <dt>
                  <Clock3 size={18} aria-hidden="true" /> Travel time
                </dt>
                <dd>{job.route.estimatedMinutes} min</dd>
              </div>
              <div>
                <dt>
                  {job.route.mode === "walk" ? (
                    <Footprints size={18} aria-hidden="true" />
                  ) : (
                    <Bus size={18} aria-hidden="true" />
                  )}
                  Mode
                </dt>
                <dd>{modeLabels[job.route.mode]}</dd>
              </div>
              {job.route.estimatedFarePhp ? (
                <div>
                  <dt>
                    <WalletCards size={18} aria-hidden="true" /> Est. fare
                  </dt>
                  <dd>₱{job.route.estimatedFarePhp}</dd>
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
            Return to job
          </Link>
        </aside>
      </div>
    </div>
  );
}
