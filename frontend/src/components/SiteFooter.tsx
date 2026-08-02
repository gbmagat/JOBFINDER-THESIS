import { Link } from "react-router-dom";

export function SiteFooter({
  variant = "default",
}: {
  variant?: "default" | "lgu";
}) {
  const isLgu = variant === "lgu";

  return (
    <footer className="site-footer" aria-label="JobFinder footer">
      <div className="site-footer__inner">
        <div className="site-footer__identity">
          <Link className="site-footer__brand" to="/">
            JobFinder
          </Link>
          <p>
            {isLgu
              ? "PESO / LGU job-post verification workspace."
              : "Local jobs from PESO and LGU datasets."}
          </p>
        </div>

        <nav className="site-footer__links" aria-label="Footer navigation">
          {isLgu ? (
            <>
              <Link to="/lgu/verification">Review Guide</Link>
              <Link to="/about/data-sources">Data Sources</Link>
              <Link to="/lgu/audit-log">Audit Log</Link>
            </>
          ) : (
            <>
              <Link to="/jobs">Browse Local Jobs</Link>
              <Link to="/about/data-sources">Data Sources</Link>
              <Link to="/employer">Employer Workspace</Link>
            </>
          )}
        </nav>

        <p className="site-footer__legal">
          {"\u00A9"} {new Date().getFullYear()} JobFinder. {isLgu ? "Authorized LGU workspace." : "All rights reserved."}
        </p>
      </div>
    </footer>
  );
}
