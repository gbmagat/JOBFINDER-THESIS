import type {
  LguAuditEntry,
  LguEmployerRecord,
  LguOverview,
  LguVerificationItem,
} from "./types";

export const LGU_OVERVIEW: LguOverview = {
  metrics: [
    { value: 9, label: "Pending Job Posts", note: "Awaiting a reviewer", tone: "warning" },
    { value: 3, label: "Employers Need Evidence", note: "Documents or contacts missing", tone: "warning" },
    { value: 24, label: "Approved This Month", note: "Published after review", tone: "success" },
    { value: 2, label: "Returned for Changes", note: "Waiting for the employer" },
  ],
  recentActivity: [
    { id: "a1", title: "Service Crew approved", detail: "Northpoint Café · reviewed by Ana D.", time: "9:41 AM", status: "Published" },
    { id: "a2", title: "Warehouse Assistant needs changes", detail: "Pampanga Logistics · workplace pin required", time: "9:18 AM", status: "Returned" },
    { id: "a3", title: "Front Desk Associate submitted", detail: "Hotel Nueve · business permit pending", time: "Yesterday", status: "New" },
    { id: "a4", title: "IT Support Assistant approved", detail: "Lumina Tech Solutions", time: "Yesterday", status: "Published" },
  ],
  priorities: [
    { id: "p1", label: "High Priority", title: "Employer Proof Missing", detail: "Hotel Nueve · affects 2 submissions", tone: "warning" },
    { id: "p2", label: "Check Location", title: "Workplace Pin Needed", detail: "Pampanga Logistics · Cutcut", tone: "default" },
    { id: "p3", label: "Ready to Review", title: "Complete Submission", detail: "Northpoint Café · Service Crew", tone: "success" },
  ],
};

export const LGU_VERIFICATION_ITEMS: LguVerificationItem[] = [
  { id: "service-crew-northpoint", jobTitle: "Service Crew", employer: "Northpoint Café", location: "Balibago", evidence: "Complete Details", evidenceTone: "success", riskLevel: "low", risk: "Low risk · New submission", submitted: "18 min ago" },
  { id: "warehouse-assistant-pampanga", jobTitle: "Warehouse Assistant", employer: "Pampanga Logistics", location: "Cutcut", evidence: "Check Location", evidenceTone: "warning", riskLevel: "high", risk: "Employer verification requires escalation", submitted: "2 hours ago" },
  { id: "front-desk-hotel-nueve", jobTitle: "Front Desk Associate", employer: "Hotel Nueve", location: "Clark", evidence: "Employer Proof Needed", evidenceTone: "warning", riskLevel: "medium", risk: "Business permit required", submitted: "1 day ago" },
];

export const LGU_EMPLOYERS: LguEmployerRecord[] = [
  { id: "northpoint-cafe", name: "Northpoint Café", location: "Balibago", evidence: "DTI + contact complete", activeJobs: 3, status: "Verified" },
  { id: "pampanga-logistics", name: "Pampanga Logistics", location: "Cutcut", evidence: "Workplace pin missing", activeJobs: 1, status: "Needs Evidence" },
  { id: "hotel-nueve", name: "Hotel Nueve", location: "Clark", evidence: "Business permit missing", activeJobs: 2, status: "Needs Evidence" },
  { id: "lumina-tech", name: "Lumina Tech Solutions", location: "St. Rosario", evidence: "Complete", activeJobs: 4, status: "Verified" },
];

export const LGU_AUDIT_ENTRIES: LguAuditEntry[] = [
  { id: "log-1", time: "9:41 AM", reviewer: "Ana D.", action: "Approved job post", subject: "Service Crew — Northpoint Café", detail: "Submission published", tone: "success" },
  { id: "log-2", time: "9:18 AM", reviewer: "Mark R.", action: "Requested changes", subject: "Warehouse Assistant — Pampanga Logistics", detail: "Workplace pin required", tone: "warning" },
  { id: "log-3", time: "Yesterday", reviewer: "Ana D.", action: "Verified employer", subject: "Lumina Tech Solutions", detail: "Business and contact evidence complete", tone: "success" },
  { id: "log-4", time: "Yesterday", reviewer: "Mark R.", action: "Rejected job post", subject: "Front Desk Associate — Hotel Nueve", detail: "Missing business permit", tone: "danger" },
];
