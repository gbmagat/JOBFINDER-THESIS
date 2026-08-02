import { Router } from "express";
import { requireRole } from "../auth.js";
import { rowToJob } from "../db.js";
import { requiredText, sendError } from "../http.js";

const EMPLOYER_STATUSES = [
  "pending",
  "verified",
  "changes-requested",
  "rejected",
];
const JOB_REVIEW_STATUSES = [
  "draft",
  "pending",
  "approved",
  "changes-requested",
  "rejected",
];
const EMPLOYER_DECISIONS = {
  approve: "verified",
  verify: "verified",
  "request-changes": "changes-requested",
  reject: "rejected",
};
const JOB_DECISIONS = {
  approve: "approved",
  "request-changes": "changes-requested",
  reject: "rejected",
};

function parseJson(value, fallback) {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function recordAuditEvent(
  db,
  { actorId, action, entityType, entityId, summary, reason = "", metadata = {} },
) {
  const createdAt = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO audit_events
      (actor_id, action, entity_type, entity_id, summary, reason, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    actorId,
    action,
    entityType,
    entityId,
    summary,
    reason,
    JSON.stringify(metadata),
    createdAt,
  );
  return { id: Number(result.lastInsertRowid), createdAt };
}

function verificationResponse(row) {
  return {
    status: row.verification_status ?? "pending",
    evidence: parseJson(row.evidence_json, []),
    decisionReason: row.decision_reason ?? "",
    reviewedBy: row.verification_reviewed_by ?? null,
    reviewedAt: row.verification_reviewed_at ?? null,
    updatedAt: row.verification_updated_at ?? null,
  };
}

function employerResponse(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    companyName: row.company_name || row.display_name,
    description: row.description || "",
    address: row.address || "",
    website: row.website || "",
    details: parseJson(row.details_json, {}),
    verification: verificationResponse(row),
    activeJobs: Number(row.active_jobs ?? 0),
    totalJobs: Number(row.total_jobs ?? 0),
    createdAt: row.created_at,
    updatedAt: row.company_updated_at ?? null,
  };
}

function employerListResponse(employer) {
  const statusLabels = {
    verified: "Verified",
    pending: "Pending Review",
    "changes-requested": "Needs Evidence",
    rejected: "Rejected",
  };
  const status = statusLabels[employer.verification.status] ?? "Pending Review";
  const completeEvidence = employer.verification.evidence.filter(
    (item) => item?.status === "complete" || item?.status === "confirmed",
  ).length;
  return {
    id: employer.id,
    name: employer.companyName,
    location:
      employer.details.barangay || employer.address || "Angeles City",
    evidence: completeEvidence
      ? `${completeEvidence} evidence item${completeEvidence === 1 ? "" : "s"} complete`
      : status === "Verified"
        ? "Complete"
        : "Evidence required",
    activeJobs: employer.activeJobs,
    status,
  };
}

function employerQuery() {
  return `
    SELECT users.id, users.email, users.display_name, users.created_at,
           company_profiles.company_name, company_profiles.description,
           company_profiles.address, company_profiles.website,
           company_profiles.details_json,
           company_profiles.updated_at AS company_updated_at,
           employer_verifications.status AS verification_status,
           employer_verifications.evidence_json,
           employer_verifications.decision_reason,
           employer_verifications.reviewed_by AS verification_reviewed_by,
           employer_verifications.reviewed_at AS verification_reviewed_at,
           employer_verifications.updated_at AS verification_updated_at,
           (SELECT COUNT(*) FROM jobs
            WHERE jobs.owner_id = users.id
              AND jobs.status = 'active'
              AND jobs.review_status = 'approved') AS active_jobs,
           (SELECT COUNT(*) FROM jobs
            WHERE jobs.owner_id = users.id) AS total_jobs
    FROM users
    LEFT JOIN company_profiles ON company_profiles.user_id = users.id
    LEFT JOIN employer_verifications
      ON employer_verifications.employer_id = users.id
  `;
}

function getEmployer(db, employerId) {
  const row = db.prepare(`
    ${employerQuery()}
    WHERE users.role = 'employer' AND users.id = ?
  `).get(employerId);
  return row ? employerResponse(row) : null;
}

function jobResponse(db, row) {
  const job = rowToJob(row);
  if (!job) return null;
  const employer = job.ownerId ? getEmployer(db, job.ownerId) : null;
  return {
    ...job,
    employer: employer
      ? {
          id: employer.id,
          companyName: employer.companyName,
          verification: employer.verification,
        }
      : null,
  };
}

function verificationItem(job) {
  const verificationStatus = job.employer?.verification?.status ?? "pending";
  const complete = verificationStatus === "verified";
  const highRisk = ["changes-requested", "rejected"].includes(
    verificationStatus,
  );
  return {
    id: job.id,
    jobTitle: job.title,
    employer: job.employerName,
    location: job.location?.barangay || job.location?.city || "Angeles City",
    evidence: complete ? "Complete Details" : "Employer Proof Needed",
    evidenceTone: complete ? "success" : "warning",
    riskLevel: highRisk ? "high" : complete ? "low" : "medium",
    risk:
      job.reviewReason ||
      (verificationStatus === "rejected"
        ? "High risk · Employer record rejected"
        : verificationStatus === "changes-requested"
          ? "High risk · Employer evidence requires changes"
          : complete
            ? "Low risk · Employer verified"
            : "Employer evidence requires review"),
    submitted: job.submittedForReviewAt || job.postedAt,
  };
}

function auditResponse(row) {
  return {
    id: row.id,
    actor: {
      id: row.actor_id,
      displayName: row.actor_name,
      email: row.actor_email,
    },
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    reason: row.reason,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
  };
}

function auditEntry(event) {
  const actionLabels = {
    "job.approved": "Approved job post",
    "job.changes_requested": "Requested changes",
    "job.rejected": "Rejected job post",
    "employer.verified": "Verified employer",
    "employer.changes_requested": "Requested employer evidence",
    "employer.rejected": "Rejected employer record",
  };
  const negative = event.action.endsWith("rejected");
  const warning = event.action.endsWith("changes_requested");
  return {
    id: String(event.id),
    time: event.createdAt,
    reviewer: event.actor.displayName,
    action: actionLabels[event.action] ?? event.action,
    subject: event.summary,
    detail: event.reason || "Decision recorded.",
    tone: negative ? "danger" : warning ? "warning" : "success",
  };
}

function recentAudit(db, limit = 8) {
  return db.prepare(`
    SELECT audit_events.*, users.display_name AS actor_name,
           users.email AS actor_email
    FROM audit_events
    JOIN users ON users.id = audit_events.actor_id
    ORDER BY audit_events.created_at DESC, audit_events.id DESC
    LIMIT ?
  `).all(limit).map(auditResponse);
}

export function createLguRouter(db) {
  const router = Router();
  router.use(requireRole("peso-lgu"));

  router.get("/overview", (_request, response) => {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const metrics = {
      pendingJobPosts: db.prepare(`
        SELECT COUNT(*) AS count FROM jobs
        WHERE owner_id IS NOT NULL AND review_status = 'pending'
      `).get().count,
      employersNeedEvidence: db.prepare(`
        SELECT COUNT(*) AS count FROM employer_verifications
        WHERE status IN ('pending', 'changes-requested')
      `).get().count,
      approvedThisMonth: db.prepare(`
        SELECT COUNT(*) AS count FROM audit_events
        WHERE action = 'job.approved' AND created_at >= ?
      `).get(monthStart.toISOString()).count,
      returnedForChanges: db.prepare(`
        SELECT COUNT(*) AS count FROM jobs
        WHERE owner_id IS NOT NULL AND review_status = 'changes-requested'
      `).get().count,
    };
    const priorityJobs = db.prepare(`
      SELECT * FROM jobs
      WHERE owner_id IS NOT NULL AND review_status = 'pending'
      ORDER BY submitted_for_review_at ASC, created_at ASC
      LIMIT 5
    `).all().map((row) => jobResponse(db, row));
    const priorityEmployers = db.prepare(`
      ${employerQuery()}
      WHERE users.role = 'employer'
        AND employer_verifications.status IN ('pending', 'changes-requested')
      ORDER BY employer_verifications.updated_at ASC
      LIMIT 5
    `).all().map(employerResponse);
    const audit = recentAudit(db);
    response.json({
      metrics: [
        {
          value: metrics.pendingJobPosts,
          label: "Pending Job Posts",
          note: "Awaiting a reviewer",
          tone: "warning",
        },
        {
          value: metrics.employersNeedEvidence,
          label: "Employers Need Evidence",
          note: "Documents or contacts missing",
          tone: "warning",
        },
        {
          value: metrics.approvedThisMonth,
          label: "Approved This Month",
          note: "Published after review",
          tone: "success",
        },
        {
          value: metrics.returnedForChanges,
          label: "Returned for Changes",
          note: "Waiting for the employer",
        },
      ],
      recentActivity: audit.map((event) => ({
        id: String(event.id),
        title: event.summary,
        detail: event.reason || `Reviewed by ${event.actor.displayName}`,
        time: event.createdAt,
        status: auditEntry(event).action,
      })),
      priorities: [
        ...priorityJobs.map((job) => ({
          id: `job-${job.id}`,
          label: "Job Review",
          title: job.title,
          detail: `${job.employerName} · ${job.location?.barangay || "Angeles City"}`,
          tone: "warning",
        })),
        ...priorityEmployers.map((employer) => ({
          id: `employer-${employer.id}`,
          label: "Employer Evidence",
          title: employer.companyName,
          detail: employer.address || "Employer record needs review",
          tone: "default",
        })),
      ].slice(0, 6),
    });
  });

  router.get("/employers", (request, response) => {
    const status = String(request.query.status ?? "").trim();
    const query = String(request.query.query ?? "").trim();
    if (status && !EMPLOYER_STATUSES.includes(status)) {
      sendError(response, 400, "VALIDATION_ERROR", "Choose a valid employer status.", {
        status: "Choose pending, verified, changes-requested, or rejected.",
      });
      return;
    }
    const pattern = `%${query}%`;
    const rows = db.prepare(`
      ${employerQuery()}
      WHERE users.role = 'employer'
        AND (? = '' OR employer_verifications.status = ?)
        AND (? = '' OR users.display_name LIKE ? OR users.email LIKE ?
             OR company_profiles.company_name LIKE ? OR company_profiles.address LIKE ?)
      ORDER BY employer_verifications.updated_at DESC, users.created_at DESC
    `).all(status, status, query, pattern, pattern, pattern, pattern);
    response.json({
      employers: rows.map(employerResponse).map(employerListResponse),
    });
  });

  router.get("/employers/:employerId", (request, response) => {
    const employer = getEmployer(db, request.params.employerId);
    if (!employer) {
      sendError(response, 404, "EMPLOYER_NOT_FOUND", "Employer record not found.");
      return;
    }
    const jobs = db.prepare(`
      SELECT * FROM jobs WHERE owner_id = ? ORDER BY created_at DESC
    `).all(employer.id).map((row) => jobResponse(db, row));
    const evidence = employer.verification.evidence;
    const checklist = [
      ["business-registration", "Business registration"],
      ["business-contact", "Business contact"],
      ["workplace-address", "Workplace address"],
    ].map(([id, label]) => ({
      id,
      label,
      status: evidence.find((item) => item?.type === id)?.status ?? "missing",
    }));
    response.json({ employer, checklist, evidence, jobs });
  });

  router.post("/employers/:employerId/decision", (request, response) => {
    const decision = String(request.body?.decision ?? "").trim();
    const reason = requiredText(request.body?.note ?? request.body?.reason, 1000);
    const status = EMPLOYER_DECISIONS[decision];
    if (!status) {
      sendError(response, 400, "VALIDATION_ERROR", "Choose a valid employer decision.", {
        decision: "Choose approve, request-changes, or reject.",
      });
      return;
    }
    if ((decision === "request-changes" || decision === "reject") && !reason) {
      sendError(response, 400, "VALIDATION_ERROR", "Explain the employer decision.", {
        reason: "A reason is required when requesting changes or rejecting an employer.",
      });
      return;
    }
    const employer = getEmployer(db, request.params.employerId);
    if (!employer) {
      sendError(response, 404, "EMPLOYER_NOT_FOUND", "Employer record not found.");
      return;
    }
    const now = new Date().toISOString();
    let hiddenJobs = 0;
    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE employer_verifications
        SET status = ?, decision_reason = ?, reviewed_by = ?,
            reviewed_at = ?, updated_at = ?
        WHERE employer_id = ?
      `).run(status, reason, request.user.id, now, now, employer.id);
      if (status !== "verified") {
        const withdrawalReason =
          reason || "Employer verification must be restored before publication.";
        hiddenJobs = db.prepare(`
          UPDATE jobs
          SET status = 'draft', review_status = 'changes-requested',
              review_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
          WHERE owner_id = ? AND status = 'active' AND review_status = 'approved'
        `).run(
          withdrawalReason,
          request.user.id,
          now,
          now,
          employer.id,
        ).changes;
      }
      recordAuditEvent(db, {
        actorId: request.user.id,
        action: `employer.${status === "verified" ? "verified" : status.replace("-", "_")}`,
        entityType: "employer",
        entityId: employer.id,
        summary: `${employer.companyName} verification changed to ${status}.`,
        reason,
        metadata: {
          previousStatus: employer.verification.status,
          status,
          hiddenJobs,
        },
      });
    });
    transaction();
    response.json({ status, hiddenJobs, employer: getEmployer(db, employer.id) });
  });

  router.get(["/jobs", "/verification"], (request, response) => {
    const status = String(request.query.status ?? "pending").trim();
    const query = String(request.query.query ?? "").trim();
    if (status && status !== "all" && !JOB_REVIEW_STATUSES.includes(status)) {
      sendError(response, 400, "VALIDATION_ERROR", "Choose a valid job review status.", {
        status: "Choose draft, pending, approved, changes-requested, or rejected.",
      });
      return;
    }
    const pattern = `%${query}%`;
    const rows = db.prepare(`
      SELECT * FROM jobs
      WHERE owner_id IS NOT NULL
        AND (? = 'all' OR review_status = ?)
        AND (? = '' OR title LIKE ? OR employer_name LIKE ?)
      ORDER BY submitted_for_review_at ASC, created_at ASC
    `).all(status || "pending", status || "pending", query, pattern, pattern);
    const jobs = rows.map((row) => jobResponse(db, row));
    response.json(
      request.path === "/verification"
        ? { items: jobs.map(verificationItem) }
        : { jobs },
    );
  });

  router.get(["/jobs/:jobId", "/verification/jobs/:jobId"], (request, response) => {
    const row = db.prepare(`
      SELECT * FROM jobs WHERE id = ? AND owner_id IS NOT NULL
    `).get(request.params.jobId);
    const job = jobResponse(db, row);
    if (!job) {
      sendError(response, 404, "JOB_NOT_FOUND", "Employer job post not found.");
      return;
    }
    if (request.path.startsWith("/verification/")) {
      const { employer, ...jobRecord } = job;
      response.json({
        job: jobRecord,
        employer,
        evidence: employer?.verification?.evidence ?? [],
        status: job.reviewStatus,
      });
      return;
    }
    response.json({ job });
  });

  router.post(
    ["/jobs/:jobId/decision", "/verification/jobs/:jobId/decision"],
    (request, response) => {
    const decision = String(request.body?.decision ?? "").trim();
    const reason = requiredText(request.body?.note ?? request.body?.reason, 1000);
    const reviewStatus = JOB_DECISIONS[decision];
    if (!reviewStatus) {
      sendError(response, 400, "VALIDATION_ERROR", "Choose a valid job decision.", {
        decision: "Choose approve, request-changes, or reject.",
      });
      return;
    }
    if (decision !== "approve" && !reason) {
      sendError(response, 400, "VALIDATION_ERROR", "Explain the job decision.", {
        reason: "A reason is required when requesting changes or rejecting a job.",
      });
      return;
    }
    const row = db.prepare(`
      SELECT * FROM jobs WHERE id = ? AND owner_id IS NOT NULL
    `).get(request.params.jobId);
    if (!row) {
      sendError(response, 404, "JOB_NOT_FOUND", "Employer job post not found.");
      return;
    }
    if (row.review_status !== "pending") {
      sendError(response, 409, "JOB_NOT_PENDING", "This job is not awaiting review.");
      return;
    }
    if (decision === "approve") {
      const employerVerification = db.prepare(`
        SELECT status FROM employer_verifications WHERE employer_id = ?
      `).get(row.owner_id);
      if (employerVerification?.status !== "verified") {
        sendError(
          response,
          409,
          "EMPLOYER_NOT_VERIFIED",
          "Verify the employer record before approving this job post.",
        );
        return;
      }
    }
    if (
      decision === "approve" &&
      (!row.closing_at || Date.parse(row.closing_at) <= Date.now())
    ) {
      sendError(
        response,
        409,
        "JOB_DEADLINE_PASSED",
        "The employer must set a future application deadline before approval.",
      );
      return;
    }
    const now = new Date().toISOString();
    const source = parseJson(row.source_json, {});
    if (decision === "approve" && !source.publishedAt) source.publishedAt = now;
    const status = decision === "approve" ? "active" : "draft";
    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE jobs
        SET status = ?, review_status = ?, review_reason = ?, reviewed_by = ?,
            reviewed_at = ?, source_json = ?, updated_at = ?
        WHERE id = ?
      `).run(
        status,
        reviewStatus,
        reason,
        request.user.id,
        now,
        JSON.stringify(source),
        now,
        row.id,
      );
      recordAuditEvent(db, {
        actorId: request.user.id,
        action: `job.${reviewStatus === "approved" ? "approved" : reviewStatus.replace("-", "_")}`,
        entityType: "job",
        entityId: row.id,
        summary: `${row.title} review changed to ${reviewStatus}.`,
        reason,
        metadata: { employerId: row.owner_id, previousStatus: row.review_status, reviewStatus },
      });
    });
    transaction();
    const saved = db.prepare("SELECT * FROM jobs WHERE id = ?").get(row.id);
    const job = jobResponse(db, saved);
    if (request.path.startsWith("/verification/")) {
      const { employer, ...jobRecord } = job;
      response.json({
        job: jobRecord,
        employer,
        evidence: employer?.verification?.evidence ?? [],
        status: job.reviewStatus,
      });
      return;
    }
    response.json({ job });
    },
  );

  router.get(["/audit", "/audit-log"], (request, response) => {
    const action = String(request.query.action ?? "").trim();
    const entityType = String(request.query.entityType ?? "").trim();
    const page = Math.max(Number.parseInt(String(request.query.page ?? "1"), 10) || 1, 1);
    const pageSize = Math.min(
      Math.max(Number.parseInt(String(request.query.pageSize ?? "50"), 10) || 50, 1),
      100,
    );
    const where = [];
    const values = [];
    if (action) {
      where.push("audit_events.action = ?");
      values.push(action);
    }
    if (entityType) {
      where.push("audit_events.entity_type = ?");
      values.push(entityType);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = db.prepare(`
      SELECT COUNT(*) AS count FROM audit_events ${clause}
    `).get(...values).count;
    const events = db.prepare(`
      SELECT audit_events.*, users.display_name AS actor_name,
             users.email AS actor_email
      FROM audit_events
      JOIN users ON users.id = audit_events.actor_id
      ${clause}
      ORDER BY audit_events.created_at DESC, audit_events.id DESC
      LIMIT ? OFFSET ?
    `).all(...values, pageSize, (page - 1) * pageSize).map(auditResponse);
    response.json(
      request.path === "/audit-log"
        ? { entries: events.map(auditEntry), page, pageSize, total }
        : { events, page, pageSize, total },
    );
  });

  return router;
}
