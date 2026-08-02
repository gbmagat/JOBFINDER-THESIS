export type LguDecision = "approve" | "request-changes" | "reject";

export interface LguMetric {
  label: string;
  value: number;
  note: string;
  tone?: "default" | "warning" | "success";
}

export interface LguActivity {
  id: string;
  title: string;
  detail: string;
  time: string;
  status: string;
}

export interface LguPriority {
  id: string;
  label: string;
  title: string;
  detail: string;
  tone: "warning" | "success" | "default";
}

export interface LguOverview {
  metrics: LguMetric[];
  priorities: LguPriority[];
  recentActivity: LguActivity[];
}

export interface LguVerificationItem {
  id: string;
  jobTitle: string;
  employer: string;
  location: string;
  evidence: string;
  evidenceTone: "warning" | "success" | "default";
  riskLevel: "low" | "medium" | "high";
  risk: string;
  submitted: string;
}

export interface LguEmployerRecord {
  id: string;
  name: string;
  location: string;
  evidence: string;
  activeJobs: number;
  status: "Verified" | "Needs Evidence" | "Pending Review" | "Rejected";
}

export interface LguAuditEntry {
  id: string;
  time: string;
  reviewer: string;
  action: string;
  subject: string;
  detail: string;
  tone: "warning" | "success" | "danger";
}

export interface LguDecisionInput {
  decision: LguDecision;
  note: string;
}

export interface LguEvidenceItem {
  type?: string;
  label?: string;
  status?: string;
  detail?: string;
}

export interface LguEmployerVerification {
  status: "pending" | "verified" | "changes-requested" | "rejected";
  evidence: LguEvidenceItem[];
  decisionReason: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  updatedAt: string | null;
}

export interface LguEmployerDetail {
  id: string;
  email: string;
  displayName: string;
  companyName: string;
  description: string;
  address: string;
  website: string;
  details: Record<string, unknown>;
  verification: LguEmployerVerification;
  activeJobs: number;
  totalJobs: number;
}

export interface LguJobDetail {
  id: string;
  title: string;
  employerName: string;
  summary: string;
  description: string;
  location: Record<string, unknown>;
  employmentType: string;
  workArrangement: string;
  schedule?: string;
  openingCount: number;
  salary: Record<string, unknown>;
  requirements: Record<string, unknown>;
  reviewStatus: string;
  reviewReason: string;
}

export interface LguJobReviewResponse {
  job: LguJobDetail;
  employer: Pick<LguEmployerDetail, "id" | "companyName" | "verification"> | null;
  evidence: LguEvidenceItem[];
  status: string;
}

export interface LguEmployerChecklistItem {
  id: string;
  label: string;
  status: string;
}

export interface LguEmployerReviewResponse {
  employer: LguEmployerDetail;
  checklist: LguEmployerChecklistItem[];
  evidence: LguEvidenceItem[];
  jobs: LguJobDetail[];
}
