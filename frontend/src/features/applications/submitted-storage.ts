import { userStorageKey } from "../../lib/storage-keys";
import {
  APPLICATION_REVIEW_STATUSES_STORAGE_KEY,
  CANDIDATE_STATUSES_STORAGE_KEY,
  EMPLOYER_APPLICATION_INBOX_STORAGE_KEY,
  SUBMITTED_APPLICATIONS_STORAGE_KEY,
  type ApplicantApplicationStatus,
  type EmployerReviewStatus,
  type StoredApplicationReviewStatus,
  type StoredSubmittedApplication,
} from "./storage-contract";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function parseSubmittedApplication(
  value: unknown,
): StoredSubmittedApplication | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.id !== "string" ||
    typeof value.jobId !== "string" ||
    typeof value.jobTitle !== "string" ||
    typeof value.employerName !== "string" ||
    typeof value.location !== "string" ||
    typeof value.recipientEmployerId !== "string" ||
    typeof value.appliedAt !== "string" ||
    value.status !== "Submitted" ||
    typeof value.message !== "string" ||
    !isRecord(value.applicant) ||
    typeof value.applicant.fullName !== "string" ||
    typeof value.applicant.email !== "string" ||
    typeof value.applicant.mobile !== "string" ||
    !isRecord(value.resume) ||
    typeof value.resume.name !== "string" ||
    typeof value.resume.sizeBytes !== "number" ||
    typeof value.resume.type !== "string"
  ) {
    return null;
  }

  const applicantAccountId =
    typeof value.applicantAccountId === "string"
      ? value.applicantAccountId
      : `mock-${value.applicant.email.trim().toLowerCase()}`;

  return {
    ...(value as unknown as StoredSubmittedApplication),
    applicantAccountId,
  };
}

export function readSubmittedApplications(
  storage: Storage | null = getLocalStorage(),
  storageKey = SUBMITTED_APPLICATIONS_STORAGE_KEY,
): StoredSubmittedApplication[] {
  if (!storage) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(storage.getItem(storageKey) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.flatMap((value) => {
          const application = parseSubmittedApplication(value);
          return application ? [application] : [];
        })
      : [];
  } catch {
    return [];
  }
}

export function readEmployerApplications(
  employerId: string | null | undefined,
  storage: Storage | null = getLocalStorage(),
): StoredSubmittedApplication[] {
  if (!employerId) {
    return [];
  }

  return readSubmittedApplications(
    storage,
    userStorageKey(EMPLOYER_APPLICATION_INBOX_STORAGE_KEY, employerId),
  ).filter(
    (application) => application.recipientEmployerId === employerId,
  );
}

function parseReviewStatus(
  value: unknown,
): StoredApplicationReviewStatus | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.applicationId !== "string" ||
    typeof value.jobId !== "string" ||
    typeof value.applicantAccountId !== "string" ||
    typeof value.recipientEmployerId !== "string" ||
    typeof value.updatedAt !== "string" ||
    (value.status !== "New" &&
      value.status !== "Reviewing" &&
      value.status !== "Shortlisted" &&
      value.status !== "Not selected")
  ) {
    return null;
  }

  return value as unknown as StoredApplicationReviewStatus;
}

export function readApplicationReviewStatuses(
  applicantAccountId: string | null | undefined,
  storage: Storage | null = getLocalStorage(),
): Record<string, StoredApplicationReviewStatus> {
  if (!storage || !applicantAccountId) {
    return {};
  }

  const storageKey = userStorageKey(
    APPLICATION_REVIEW_STATUSES_STORAGE_KEY,
    applicantAccountId,
  );

  try {
    const parsed: unknown = JSON.parse(storage.getItem(storageKey) ?? "{}");
    if (!isRecord(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce<
      Record<string, StoredApplicationReviewStatus>
    >((statuses, [applicationId, value]) => {
      const status = parseReviewStatus(value);
      if (
        status &&
        status.applicationId === applicationId &&
        status.applicantAccountId === applicantAccountId
      ) {
        statuses[applicationId] = status;
      }
      return statuses;
    }, {});
  } catch {
    return {};
  }
}

export function writeApplicationReviewStatus(
  reviewStatus: StoredApplicationReviewStatus,
  storage: Storage | null = getLocalStorage(),
): boolean {
  if (!storage) {
    return false;
  }

  const storageKey = userStorageKey(
    APPLICATION_REVIEW_STATUSES_STORAGE_KEY,
    reviewStatus.applicantAccountId,
  );

  try {
    const current = readApplicationReviewStatuses(
      reviewStatus.applicantAccountId,
      storage,
    );
    storage.setItem(
      storageKey,
      JSON.stringify({
        ...current,
        [reviewStatus.applicationId]: reviewStatus,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function readEmployerCandidateStatuses(
  employerId: string | null | undefined,
  storage: Storage | null = getLocalStorage(),
): Record<string, EmployerReviewStatus> {
  if (!storage || !employerId) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(
      storage.getItem(
        userStorageKey(CANDIDATE_STATUSES_STORAGE_KEY, employerId),
      ) ?? "{}",
    );
    if (!isRecord(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce<
      Record<string, EmployerReviewStatus>
    >((statuses, [candidateKey, value]) => {
      if (
        value === "New" ||
        value === "Reviewing" ||
        value === "Shortlisted" ||
        value === "Not selected"
      ) {
        statuses[candidateKey] = value;
      }
      return statuses;
    }, {});
  } catch {
    return {};
  }
}

export function toApplicantApplicationStatus(
  status: EmployerReviewStatus,
): ApplicantApplicationStatus {
  if (status === "Reviewing") {
    return "Under review";
  }
  if (status === "New") {
    return "Submitted";
  }
  return status;
}
