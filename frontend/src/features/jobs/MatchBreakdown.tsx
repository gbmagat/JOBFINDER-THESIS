import type { ReactElement } from "react";

import type { MatchExplanation, SkillEvidence } from "./types";

export interface MatchBreakdownProps {
  match: MatchExplanation;
  compact?: boolean;
}

interface EvidenceGroupProps {
  heading: string;
  description: string;
  evidence: SkillEvidence[];
  modifier: "exact" | "related" | "missing";
}

function EvidenceGroup({
  heading,
  description,
  evidence,
  modifier,
}: EvidenceGroupProps): ReactElement {
  return (
    <section
      className={`match-breakdown__evidence match-breakdown__evidence--${modifier}`}
      aria-labelledby={`match-${modifier}-heading`}
    >
      <h3 id={`match-${modifier}-heading`}>{heading}</h3>
      <p>{description}</p>
      {evidence.length > 0 ? (
        <ul className="match-breakdown__skill-list">
          {evidence.map((skill) => (
            <li className="match-breakdown__skill" key={skill.skillId}>
              <span className={`skill-status skill-status--${modifier}`}>
                {heading.slice(0, -1)}
              </span>
              <strong>{skill.label}</strong>
              {skill.ontologyPath && skill.ontologyPath.length > 1 ? (
                <span className="match-breakdown__ontology-path">
                  Related through {skill.ontologyPath.join(" → ")}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="match-breakdown__empty">None identified.</p>
      )}
    </section>
  );
}

export function MatchBreakdown({
  match,
  compact = false,
}: MatchBreakdownProps): ReactElement {
  const skillContribution = match.skillScore * match.weights.skill;
  const locationContribution = match.locationScore * match.weights.location;

  return (
    <section
      className={`match-breakdown white-card${compact ? " match-breakdown--compact" : ""}`}
      aria-labelledby="match-breakdown-heading"
    >
      <div className="match-breakdown__header">
        <div>
          <p className="match-breakdown__eyebrow">Why this job matches</p>
          <h2 className="text-dark-blue" id="match-breakdown-heading">
            {match.overallScore}% overall match
          </h2>
        </div>
        <p
          className="match-breakdown__score match-badge"
          aria-label={`${match.overallScore} percent overall match`}
        >
          {match.overallScore}%
        </p>
      </div>

      <p className="match-breakdown__summary">{match.summary}</p>

      <div className="match-breakdown__formula" aria-label="Match score formula">
        <p>
          <strong>How the score is weighted:</strong> 70% skill fit + 30%
          location accessibility
        </p>
        <dl className="match-breakdown__scores">
          <div>
            <dt>Skill fit</dt>
            <dd>
              {match.skillScore}% × 70% = {skillContribution.toFixed(1)} points
            </dd>
          </div>
          <div>
            <dt>Location accessibility</dt>
            <dd>
              {match.locationScore}% × 30% ={" "}
              {locationContribution.toFixed(1)} points
            </dd>
          </div>
          <div>
            <dt>Weighted result</dt>
            <dd>
              {(skillContribution + locationContribution).toFixed(1)} points,
              shown as {match.overallScore}%
            </dd>
          </div>
        </dl>
      </div>

      {!compact ? (
        <div className="match-breakdown__evidence-grid">
          <EvidenceGroup
            heading="Exact"
            description="Skills that directly match the role requirement."
            evidence={match.exactSkills}
            modifier="exact"
          />
          <EvidenceGroup
            heading="Related"
            description="Transferable skills connected through the ontology."
            evidence={match.relatedSkills}
            modifier="related"
          />
          <EvidenceGroup
            heading="Missing"
            description="Skills not yet found in your current evidence."
            evidence={match.missingSkills}
            modifier="missing"
          />
        </div>
      ) : null}

      <p className="match-breakdown__method-note">
        JobFinder displays the API&apos;s explanation. It does not calculate or
        change the thesis matching result in the browser.
      </p>
    </section>
  );
}
