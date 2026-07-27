import {
  Building2,
  CalendarClock,
  Database,
  ExternalLink,
  Info,
  ShieldCheck,
} from "lucide-react";

export function DataSourcesPage() {
  return (
    <div className="page page--narrow">
      <header className="page-header">
        <span className="eyebrow">
          <Database size={16} aria-hidden="true" />
          Data transparency
        </span>
        <h1>Where job listings come from</h1>
        <p>
          JobFinder combines direct employer posts with opportunity datasets
          provided by PESO and LGU offices. Every imported listing keeps its
          original source and application method.
        </p>
      </header>

      <section className="content-grid" aria-label="Job data sources">
        <article className="content-card">
          <span className="icon-tile">
            <Building2 size={22} aria-hidden="true" />
          </span>
          <h2>Direct employer posts</h2>
          <p>
            Employers create and maintain these listings in JobFinder. A direct
            post can use JobFinder&apos;s native application form.
          </p>
        </article>
        <article className="content-card">
          <span className="icon-tile icon-tile--soft">
            <Database size={22} aria-hidden="true" />
          </span>
          <h2>PESO/LGU datasets</h2>
          <p>
            PESO and LGU organizations provide datasets; they do not have an
            approval queue or user workspace in JobFinder. Imported records
            remain read-only and retain their original instructions.
          </p>
        </article>
      </section>

      <section className="stack-section" aria-labelledby="shown-heading">
        <h2 id="shown-heading">What each sourced listing shows</h2>
        <div className="check-list">
          <div>
            <ShieldCheck size={20} aria-hidden="true" />
            <span>
              <strong>Origin</strong>
              Employer name or PESO/LGU organization and dataset
            </span>
          </div>
          <div>
            <CalendarClock size={20} aria-hidden="true" />
            <span>
              <strong>Freshness</strong>
              Published or last-synced date, with current, stale, or unknown
              status
            </span>
          </div>
          <div>
            <ExternalLink size={20} aria-hidden="true" />
            <span>
              <strong>Original application method</strong>
              JobFinder form, external page, email, phone, or in-person
              instructions
            </span>
          </div>
        </div>
      </section>

      <aside className="notice" aria-label="Important data note">
        <Info size={20} aria-hidden="true" />
        <p>
          A source label describes where the record came from; it does not mean
          JobFinder independently verified every detail. Check the source,
          freshness, and application instructions before submitting personal
          information.
        </p>
      </aside>
    </div>
  );
}
