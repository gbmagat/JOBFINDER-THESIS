import type { ReactElement } from "react";
import { Link } from "react-router-dom";

import { jobSourceLabel } from "./data";
import type { JobListing } from "./types";

export interface JobCardProps {
  job: JobListing;
  showMatch?: boolean;
  showSummary?: boolean;
  showDistanceFact?: boolean;
  isShownOnMap?: boolean;
  onShowOnMap?: () => void;
}

export function JobCard({
  job,
  showMatch = false,
  showSummary = true,
  showDistanceFact = false,
  isShownOnMap = false,
  onShowOnMap,
}: JobCardProps): ReactElement {
  const detailsHref = `/jobs/${encodeURIComponent(job.id)}`;

  return (
    <article className="job-card white-card" aria-labelledby={`job-${job.id}`}>
      {onShowOnMap ? (
        <button
          aria-label={
            isShownOnMap
              ? `Deselect ${job.title} and show all jobs on map`
              : `Select ${job.title} on map`
          }
          aria-pressed={isShownOnMap}
          className="job-card__select-action"
          onClick={onShowOnMap}
          type="button"
        />
      ) : null}

      <div className="job-card__header">
        <div>
          <p className="job-card__source source-label">
            {jobSourceLabel(job.source)}
          </p>
          <h2 className="job-card__title text-dark-blue" id={`job-${job.id}`}>
            <Link className="job-card__title-link dark-blue-link" to={detailsHref}>
              {job.title}
            </Link>
          </h2>
          <p className="job-card__employer">{job.employerName}</p>
        </div>

        {showMatch ? (
          <p
            className="job-card__match match-badge"
            aria-label={`${job.fit.overallScore} percent overall match`}
          >
            <strong>{job.fit.overallScore}%</strong>
            <span> match</span>
          </p>
        ) : null}
      </div>

      <p className="job-card__location">
        {job.location.barangay}, {job.location.city}
        {!showDistanceFact ? ` · ${job.route.distanceKm.toFixed(1)} km away` : ""}
      </p>

      <ul className="job-card__facts" aria-label="Job summary">
        <li>{job.employmentType}</li>
        <li>{job.workArrangement}</li>
        {showDistanceFact ? (
          <li>{job.route.distanceKm.toFixed(1)} km away</li>
        ) : null}
      </ul>

      {showSummary ? <p className="job-card__summary">{job.summary}</p> : null}

      <div className="job-card__footer">
        <Link
          className="job-card__details-link dark-blue-link"
          to={detailsHref}
          aria-label={`View details for ${job.title} at ${job.employerName}`}
        >
          View Details
        </Link>
      </div>
    </article>
  );
}
