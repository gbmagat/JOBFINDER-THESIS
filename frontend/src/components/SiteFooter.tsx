import { Link } from "react-router-dom";

export function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="JobFinder footer">
      <div className="site-footer__inner">
        <div className="site-footer__identity">
          <Link className="site-footer__brand" to="/">
            JobFinder
          </Link>
          <p>Local jobs from PESO and LGU datasets.</p>
        </div>

        <nav className="site-footer__links" aria-label="Footer navigation">
          <Link to="/jobs">Browse Local Jobs</Link>
          <Link to="/about/data-sources">Data Sources</Link>
          <Link to="/employer">Employer Workspace</Link>
        </nav>

        <p className="site-footer__legal">
          {"\u00A9"} {new Date().getFullYear()} JobFinder. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
