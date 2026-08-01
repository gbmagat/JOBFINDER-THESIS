import { ArrowLeft, SearchX } from "lucide-react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="standalone-page">
      <section className="empty-state">
        <span className="icon-tile icon-tile--soft">
          <SearchX size={30} aria-hidden="true" />
        </span>
        <p className="eyebrow">404</p>
        <h1>We Could Not Find That Page</h1>
        <p>The link may be outdated, or the job may no longer be available.</p>
        <Link className="button button--primary" to="/jobs">
          <ArrowLeft size={18} aria-hidden="true" /> Browse current jobs
        </Link>
      </section>
    </div>
  );
}
