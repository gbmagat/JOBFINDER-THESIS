import type { ReactElement } from "react";

import { applicationMethodLabel } from "./data";
import type { JobFreshness, JobSource } from "./types";

export interface SourceProvenanceProps {
  source: JobSource;
  compact?: boolean;
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value?: string): string {
  if (!value) {
    return "Not supplied";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not supplied"
    : dateTimeFormatter.format(date);
}

function freshnessLabel(freshness: JobFreshness): string {
  const labels: Record<JobFreshness, string> = {
    current: "Current according to the latest source update",
    stale: "May be out of date",
    unknown: "Freshness not confirmed",
  };

  return labels[freshness];
}

export function SourceProvenance({
  source,
  compact = false,
}: SourceProvenanceProps): ReactElement {
  const isImported = source.origin === "peso-lgu-dataset";
  const title = isImported
    ? "PESO/LGU dataset source"
    : "Direct employer source";

  return (
    <section
      className={`source-provenance white-card${compact ? " source-provenance--compact" : ""}`}
      aria-labelledby="source-provenance-heading"
    >
      <div className="source-provenance__header">
        <div>
          <p className="source-provenance__eyebrow">Job source details</p>
          <h2 className="text-dark-blue" id="source-provenance-heading">
            {title}
          </h2>
        </div>
        <span
          className={`freshness-badge freshness-badge--${source.freshness}`}
        >
          {freshnessLabel(source.freshness)}
        </span>
      </div>

      <dl className="source-provenance__details">
        <div>
          <dt>Provided by</dt>
          <dd>{source.organizationName}</dd>
        </div>
        <div>
          <dt>Source type</dt>
          <dd>
            {isImported
              ? source.organizationType === "peso"
                ? "Public Employment Service Office dataset"
                : "Local government unit dataset"
              : "Employer-submitted listing"}
          </dd>
        </div>
        {isImported ? (
          <>
            <div>
              <dt>Dataset</dt>
              <dd>{source.datasetName}</dd>
            </div>
            <div>
              <dt>Jurisdiction</dt>
              <dd>{source.jurisdiction}</dd>
            </div>
            <div>
              <dt>Source record</dt>
              <dd>{source.externalRecordId}</dd>
            </div>
          </>
        ) : null}
        {!compact ? (
          <>
            <div>
              <dt>Published by source</dt>
              <dd>{formatDateTime(source.publishedAt)}</dd>
            </div>
            <div>
              <dt>Last synchronized</dt>
              <dd>{formatDateTime(source.lastSyncedAt)}</dd>
            </div>
          </>
        ) : null}
        <div>
          <dt>Original application method</dt>
          <dd>
            {applicationMethodLabel(source.applicationMethod)}
            {source.applicationTarget
              ? ` — ${source.applicationTarget}`
              : ""}
          </dd>
        </div>
      </dl>

      {source.applicationInstructions ? (
        <p className="source-provenance__application-instructions">
          <strong>Application instructions:</strong>{" "}
          {source.applicationInstructions}
        </p>
      ) : null}

      {!compact && source.alternateApplicationMethods?.length ? (
        <div className="source-provenance__alternatives">
      <h3>Other Method in the Source Record</h3>
          <ul>
            {source.alternateApplicationMethods.map((alternative) => (
              <li key={`${alternative.method}-${alternative.target}`}>
                <strong>{applicationMethodLabel(alternative.method)}:</strong>{" "}
                {alternative.target}. {alternative.instructions}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {source.sourceUrl ? (
        <p>
          <a
            className="source-provenance__source-link dark-blue-link"
            href={source.sourceUrl}
            rel="noreferrer noopener"
            target="_blank"
          >
            Visit the listed source <span aria-hidden="true">↗</span>
          </a>
        </p>
      ) : null}

      <aside
        className={`source-provenance__notice ${
          isImported
            ? "source-provenance__notice--imported"
            : "source-provenance__notice--direct"
        }`}
        aria-label="Source trust notice"
      >
        {isImported ? (
          <p>
            This record was imported from {source.organizationName}. JobFinder
            has not independently verified the vacancy, employer, pay, or
            application instructions. Confirm the details with the listed
            source before applying or sharing sensitive information.
          </p>
        ) : (
          <p>
            The employer supplied this listing directly. This source label does
            not guarantee accreditation or independently verify every claim;
            review the details before applying or sharing sensitive
            information.
          </p>
        )}
      </aside>
    </section>
  );
}
