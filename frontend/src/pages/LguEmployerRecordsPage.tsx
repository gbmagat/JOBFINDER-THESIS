import { ArrowRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getLguEmployers } from "../features/lgu/api";
import { LguPageHeader, LguStatus } from "../features/lgu/components";
import { LGU_EMPLOYERS } from "../features/lgu/data";

export function LguEmployerRecordsPage() {
  const [employers, setEmployers] = useState(
    import.meta.env.MODE === "test" ? LGU_EMPLOYERS : [],
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (import.meta.env.MODE === "test") return;
    let active = true;
    getLguEmployers()
      .then((result) => {
        if (active) setEmployers(result.employers);
      })
      .catch(() => {
        if (active) setLoadError("Employer records could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleEmployers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return employers.filter((employer) => {
      const matchesQuery =
        !normalized ||
        `${employer.name} ${employer.location}`.toLowerCase().includes(normalized);
      const matchesStatus =
        status === "all" ||
        (status === "verified" && employer.status === "Verified") ||
        (status === "evidence" && employer.status === "Needs Evidence") ||
        (status === "pending" && employer.status === "Pending Review") ||
        (status === "rejected" && employer.status === "Rejected");
      return matchesQuery && matchesStatus;
    });
  }, [employers, query, status]);

  return (
    <div className="page lgu-page">
      <div className="page-container">
        <LguPageHeader
          eyebrow="Employer Verification"
          title="Employer Records"
          intro="Confirm the organizations and workplace evidence behind local job posts."
        />

        {loadError ? <p className="lgu-load-error" role="alert">{loadError}</p> : null}

        <section className="lgu-panel">
          <div className="lgu-panel__heading">
            <div><span className="lgu-kicker">Registered Organizations</span><h2>Local Employer Directory</h2></div>
            <LguStatus>{employers.length} Records</LguStatus>
          </div>
          <div className="lgu-toolbar lgu-toolbar--compact">
            <label className="lgu-search-field">
              <Search aria-hidden="true" />
              <span className="sr-only">Search employer records</span>
              <input onChange={(event) => setQuery(event.target.value)} placeholder="Search employer or barangay" type="search" value={query} />
            </label>
            <label className="lgu-sort-field"><span>Status</span><select onChange={(event) => setStatus(event.target.value)} value={status}><option value="all">All Records</option><option value="verified">Verified</option><option value="evidence">Needs Evidence</option><option value="pending">Pending Review</option><option value="rejected">Rejected</option></select></label>
          </div>

          <div className="table-scroll lgu-table-scroll">
            <table className="data-table lgu-data-table">
              <thead><tr><th>Employer</th><th>Location</th><th>Evidence</th><th>Active Jobs</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {visibleEmployers.map((employer) => (
                  <tr key={employer.id}>
                    <td data-label="Employer"><strong>{employer.name}</strong></td>
                    <td data-label="Location">{employer.location}</td>
                    <td data-label="Evidence">{employer.evidence}</td>
                    <td data-label="Active Jobs">{employer.activeJobs}</td>
                    <td data-label="Status"><LguStatus tone={employer.status === "Verified" ? "success" : employer.status === "Rejected" ? "danger" : "warning"}>{employer.status}</LguStatus></td>
                    <td data-label="Action"><Link className="lgu-row-link" to={`/lgu/employers/${employer.id}`}>Review <ArrowRight aria-hidden="true" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
