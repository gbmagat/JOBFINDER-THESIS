export const APPLICATION_DRAFTS_STORAGE_KEY =
  "jobfinder.application-drafts.v1";
export const SUBMITTED_APPLICATIONS_STORAGE_KEY =
  "jobfinder.submitted-applications.v1";
export const EMPLOYER_APPLICATION_INBOX_STORAGE_KEY =
  "jobfinder.employer.application-inbox.v1";
export const CANDIDATE_STATUSES_STORAGE_KEY =
  "jobfinder.employer.candidate-statuses.v1";
export const APPLICATION_REVIEW_STATUSES_STORAGE_KEY =
  "jobfinder.application-review-statuses.v1";

export type EmployerReviewStatus =
  | "New"
  | "Reviewing"
  | "Shortlisted"
  | "Not selected";

export type ApplicantApplicationStatus =
  | "Submitted"
  | "Under review"
  | "Shortlisted"
  | "Not selected";

export interface StoredSubmittedApplication {
  version: 1;
  id: string;
  jobId: string;
  jobTitle: string;
  employerName: string;
  location: string;
  applicantAccountId: string;
  recipientEmployerId: string;
  appliedAt: string;
  status: "Submitted";
  applicant: {
    fullName: string;
    email: string;
    mobile: string;
  };
  resume: {
    name: string;
    sizeBytes: number;
    type: string;
  };
  message: string;
}

export interface StoredApplicationReviewStatus {
  version: 1;
  applicationId: string;
  jobId: string;
  applicantAccountId: string;
  recipientEmployerId: string;
  status: EmployerReviewStatus;
  updatedAt: string;
}
