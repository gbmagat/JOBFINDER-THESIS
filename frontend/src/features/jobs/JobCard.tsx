import type { ReactElement } from "react";
import { Link } from "react-router";

import { jobSourceLabel } from "./data";
import type { JobListing } from "./types";

export interface JobCardProps {
  job: JobListing;
  showSummary?: boolean;
}

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function formatSalary(job: JobListing): string {
  const period = job.salary.period === "month" ? "month" : job.salary.period;
  return `${currencyFormatter.format(job.salary.minimumPhp)}–${currencyFormatter.format(
    job.salary.maximumPhp,
  )} per ${period}`;
}

export function JobCard({
  job,
  showSummary = true,
}: JobCardProps): ReactElement {
  const detailsHref = `/jobs/${encodeURIComponent(job.id)}`;
  const routeLabel =
    job.route.mode === "public-transport"
      ? "public transport"
      : job.route.mode;

  return (
    <article className="job-card white-card" aria-labelledby={`job-${job.id}`}>
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

        <p
          className="job-card__match match-badge"
          aria-label={`${job.fit.overallScore} percent overall match`}
        >
          <strong>{job.fit.overallScore}%</strong>
          <span> match</span>
        </p>
      </div>

      <p className="job-card__location">
        {job.location.barangay}, {job.location.city}
      </p>

      <ul className="job-card__facts" aria-label="Job summary">
        <li>{job.employmentType}</li>
        <li>{job.workArrangement}</li>
        <li>{formatSalary(job)}</li>
      </ul>

      <div className="job-card__fit-row" aria-label="Match and travel estimate">
        <span>{job.fit.skillScore}% skill fit</span>
        <span>{job.route.distanceKm.toFixed(1)} km</span>
        <span>{job.route.estimatedMinutes} min</span>
      </div>

      <p className="job-card__travel-note">
        Estimated by {routeLabel}
        {job.route.isEstimate ? "; confirm local conditions" : ""}
      </p>

      {showSummary ? <p className="job-card__summary">{job.summary}</p> : null}

      <div className="job-card__footer">
        <time dateTime={job.postedAt}>
          Posted {dateFormatter.format(new Date(job.postedAt))}
        </time>
        <Link
          className="job-card__details-link dark-blue-link"
          to={detailsHref}
          aria-label={`View details for ${job.title} at ${job.employerName}`}
        >
          View job details <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
