import { apiRequest } from "../../lib/api";
import type {
  LguAuditEntry,
  LguDecisionInput,
  LguEmployerRecord,
  LguEmployerReviewResponse,
  LguJobReviewResponse,
  LguOverview,
  LguVerificationItem,
} from "./types";

export function getLguOverview() {
  return apiRequest<LguOverview>("/lgu/overview");
}

export function getLguVerificationQueue() {
  return apiRequest<{ items: LguVerificationItem[] }>("/lgu/verification");
}

export function getLguJobReview(jobId: string) {
  return apiRequest<LguJobReviewResponse>(
    `/lgu/verification/jobs/${encodeURIComponent(jobId)}`,
  );
}

export function submitLguJobDecision(
  jobId: string,
  input: LguDecisionInput,
) {
  return apiRequest<{ status: string }>(
    `/lgu/verification/jobs/${encodeURIComponent(jobId)}/decision`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function getLguEmployers() {
  return apiRequest<{ employers: LguEmployerRecord[] }>("/lgu/employers");
}

export function getLguEmployerReview(employerId: string) {
  return apiRequest<LguEmployerReviewResponse>(
    `/lgu/employers/${encodeURIComponent(employerId)}`,
  );
}

export function submitLguEmployerDecision(
  employerId: string,
  input: LguDecisionInput,
) {
  return apiRequest<{ status: string }>(
    `/lgu/employers/${encodeURIComponent(employerId)}/decision`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function getLguAuditLog() {
  const entries = new Map<string, LguAuditEntry>();
  let page = 1;
  let total: number | null = null;

  while (total === null || entries.size < total) {
    const result = await apiRequest<{
      entries: LguAuditEntry[];
      page?: number;
      pageSize?: number;
      total?: number;
    }>(`/lgu/audit-log?page=${page}&pageSize=100`);

    result.entries.forEach((entry) => entries.set(entry.id, entry));
    total = typeof result.total === "number" ? result.total : entries.size;

    if (result.entries.length === 0 || entries.size >= total) break;
    page = (result.page ?? page) + 1;
  }

  return { entries: Array.from(entries.values()) };
}
