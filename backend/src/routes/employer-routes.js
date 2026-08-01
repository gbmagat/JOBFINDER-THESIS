import { Router } from "express";
import { requireRole } from "../auth.js";
import { insertJob, isJobAvailable, rowToJob } from "../db.js";
import {
  createId,
  createSlug,
  numberInRange,
  optionalText,
  requiredText,
  sendError,
  stringArray,
  validEmail,
  validHttpUrl,
} from "../http.js";
import { getUserMatch } from "../matching.js";
import { calculateRoute } from "../routing.js";

const APPLICATION_STATUSES = [
  "Submitted",
  "Under review",
  "Shortlisted",
  "Not selected",
];
const STRONG_MATCH_THRESHOLD = 85;
const EMPLOYMENT_TYPES = [
  "Full-time",
  "Part-time",
  "Contract",
  "Temporary",
  "Internship",
];
const WORK_ARRANGEMENTS = ["On-site", "Hybrid", "Remote"];

function normalizeClosingAt(value) {
  const input = optionalText(value, 40);
  if (!input) return { value: null, error: null };
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(input)
    ? Date.parse(`${input}T23:59:59.999+08:00`)
    : Date.parse(input);
  if (!Number.isFinite(timestamp)) {
    return { value: null, error: "Enter a valid application deadline." };
  }
  if (timestamp <= Date.now()) {
    return { value: null, error: "Choose a future application deadline." };
  }
  return { value: new Date(timestamp).toISOString(), error: null };
}

function parseCompanyDetails(value) {
  try {
    const details = JSON.parse(value || "{}");
    return details && typeof details === "object" && !Array.isArray(details)
      ? details
      : {};
  } catch {
    return {};
  }
}

function companyResponse(company, fallbackName = "") {
  const details = parseCompanyDetails(company?.details_json);
  const response = {
    companyName: company?.company_name || fallbackName,
    description: company?.description || "",
    address: company?.address || "",
    website: company?.website || "",
    updatedAt: company?.updated_at || null,
  };
  for (const field of [
    "industry",
    "size",
    "email",
    "phone",
    "street",
    "barangay",
    "city",
    "province",
    "benefits",
  ]) {
    if (typeof details[field] === "string") response[field] = details[field];
  }
  return response;
}

function employerJob(job) {
  const { geoNodeId: _geoNodeId, ...result } = job;
  return result;
}

function candidateMatch(db, applicantId, job) {
  const fit = getUserMatch(db, applicantId, job);
  if (!fit) return null;
  const { route: _route, ...scores } = fit;
  return scores;
}

function employerApplicationSummary(db, ownerId, jobs) {
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const countsByJob = new Map(
    jobs.map((job) => [
      job.id,
      { applicantCount: 0, newApplicantCount: 0, strongMatchCount: 0 },
    ]),
  );
  const applications = db.prepare(`
    SELECT applications.id, applications.job_id, applications.applicant_id,
           applications.full_name, applications.status, applications.submitted_at,
           jobs.title AS job_title
    FROM applications
    JOIN jobs ON jobs.id = applications.job_id
    WHERE jobs.owner_id = ?
    ORDER BY applications.submitted_at DESC
  `).all(ownerId);
  const scoresByApplication = new Map();

  for (const application of applications) {
    const job = jobsById.get(application.job_id);
    const counts = countsByJob.get(application.job_id);
    if (!job || !counts) continue;

    const overallScore = candidateMatch(db, application.applicant_id, job)?.overallScore;
    scoresByApplication.set(application.id, overallScore ?? null);
    counts.applicantCount += 1;
    if (application.status === "Submitted") counts.newApplicantCount += 1;
    if (overallScore !== undefined && overallScore >= STRONG_MATCH_THRESHOLD) {
      counts.strongMatchCount += 1;
    }
  }

  return {
    countsByJob,
    recentActivity: applications.slice(0, 3).map((application) => ({
      id: application.id,
      applicantName: application.full_name,
      jobId: application.job_id,
      jobTitle: application.job_title,
      status: application.status,
      submittedAt: application.submitted_at,
      overallScore: scoresByApplication.get(application.id) ?? null,
    })),
  };
}

function employerJobWithCounts(job, countsByJob) {
  const counts = countsByJob.get(job.id) ?? {
    applicantCount: 0,
    newApplicantCount: 0,
    strongMatchCount: 0,
  };
  return { ...employerJob(job), ...counts };
}

export function createEmployerRouter(db) {
  const router = Router();
  router.use(requireRole("employer"));

  router.get("/overview", (request, response) => {
    const jobs = db
      .prepare("SELECT * FROM jobs WHERE owner_id = ? ORDER BY created_at DESC")
      .all(request.user.id)
      .map(rowToJob);
    const { countsByJob, recentActivity } = employerApplicationSummary(
      db,
      request.user.id,
      jobs,
    );
    const counts = [...countsByJob.values()];
    response.json({
      metrics: {
        activePosts: jobs.filter((job) => isJobAvailable(job)).length,
        applicants: counts.reduce((total, item) => total + item.applicantCount, 0),
        newToReview: counts.reduce(
          (total, item) => total + item.newApplicantCount,
          0,
        ),
        strongMatches: counts.reduce(
          (total, item) => total + item.strongMatchCount,
          0,
        ),
      },
      jobs: jobs.map((job) => employerJobWithCounts(job, countsByJob)),
      recentActivity,
    });
  });

  router.get("/jobs", (request, response) => {
    const jobs = db
      .prepare("SELECT * FROM jobs WHERE owner_id = ? ORDER BY created_at DESC")
      .all(request.user.id)
      .map(rowToJob);
    const { countsByJob } = employerApplicationSummary(db, request.user.id, jobs);
    response.json({
      jobs: jobs.map((job) => employerJobWithCounts(job, countsByJob)),
    });
  });

  router.post("/jobs", (request, response) => {
    const title = requiredText(request.body?.title, 120);
    const summary = requiredText(request.body?.summary, 300);
    const description = requiredText(request.body?.description, 4000);
    const employmentType = requiredText(request.body?.employmentType, 40);
    const workArrangement = requiredText(request.body?.workArrangement, 40);
    const geoNodeId = requiredText(request.body?.geoNodeId, 80);
    const requiredSkills = stringArray(request.body?.requiredSkills, 20, 80);
    const preferredSkills = stringArray(request.body?.preferredSkills, 20, 80);
    const salaryMinimum = numberInRange(request.body?.salaryMinimumPhp, 0, 10000000, null);
    const salaryMaximum = numberInRange(request.body?.salaryMaximumPhp, 0, 10000000, null);
    const openingCount = numberInRange(request.body?.openingCount ?? 1, 1, 1000, null);
    const requestedStatus = request.body?.status ?? "draft";
    const status = requestedStatus === "active" || requestedStatus === "draft"
      ? requestedStatus
      : null;
    const closingAt = normalizeClosingAt(request.body?.closingAt);
    const node = db.prepare("SELECT * FROM geo_nodes WHERE id = ?").get(geoNodeId);
    const fields = {};

    if (!title) fields.title = "Enter a job title.";
    if (!summary) fields.summary = "Enter a short summary.";
    if (!description) fields.description = "Enter the job description.";
    if (!EMPLOYMENT_TYPES.includes(employmentType)) {
      fields.employmentType = "Choose a valid employment type.";
    }
    if (!WORK_ARRANGEMENTS.includes(workArrangement)) {
      fields.workArrangement = "Choose On-site, Hybrid, or Remote.";
    }
    if (!node) fields.geoNodeId = "Choose a supported job location.";
    if (!requiredSkills.length) fields.requiredSkills = "Add at least one required skill.";
    if (openingCount === null || !Number.isInteger(openingCount)) {
      fields.openingCount = "Enter a whole number from 1 to 1,000.";
    }
    if (salaryMinimum === null) fields.salaryMinimumPhp = "Enter the minimum salary.";
    if (salaryMaximum === null || salaryMaximum < salaryMinimum) {
      fields.salaryMaximumPhp = "Enter a maximum salary not lower than the minimum.";
    }
    if (!status) fields.status = "Choose draft or active.";
    if (closingAt.error) fields.closingAt = closingAt.error;
    if (status === "active" && !closingAt.value && !closingAt.error) {
      fields.closingAt = "Choose an application deadline before publishing.";
    }
    if (Object.keys(fields).length) {
      sendError(response, 400, "VALIDATION_ERROR", "Check the highlighted fields.", fields);
      return;
    }

    const company = db
      .prepare("SELECT * FROM company_profiles WHERE user_id = ?")
      .get(request.user.id);
    const employerName = company?.company_name || request.user.display_name;
    const now = new Date().toISOString();
    const id = `${createSlug(title) || "job"}-${createId("post").slice(-8)}`;
    const route = calculateRoute(db, "balibago", geoNodeId);
    const job = {
      id,
      geoNodeId,
      title,
      employerName,
      summary,
      description,
      location: {
        venue: requiredText(request.body?.venue, 160) || employerName,
        barangay: requiredText(request.body?.barangay, 100) || node.name,
        city: "Angeles City",
        province: "Pampanga",
        latitude: node.latitude,
        longitude: node.longitude,
      },
      employmentType,
      workArrangement,
      schedule: optionalText(request.body?.schedule, 100),
      openingCount,
      salary: {
        minimumPhp: salaryMinimum,
        maximumPhp: salaryMaximum,
        period: "month",
        negotiable: Boolean(request.body?.salaryNegotiable),
      },
      postedAt: now,
      closingAt: closingAt.value || undefined,
      requirements: {
        requiredSkills,
        preferredSkills,
        education: optionalText(request.body?.education, 600),
        experience: optionalText(request.body?.experience, 600),
        responsibilities: stringArray(request.body?.responsibilities, 20, 300),
        additionalRequirements: stringArray(
          request.body?.additionalRequirements,
          20,
          300,
        ),
      },
      route,
      source: {
        origin: "direct-employer",
        organizationName: employerName,
        organizationType: "employer",
        ownerId: request.user.id,
        freshness: "current",
        publishedAt: status === "active" ? now : undefined,
        applicationMethod: "jobfinder",
        applicationInstructions: "Sign in to apply through JobFinder.",
      },
      tags: stringArray(request.body?.tags, 12, 60),
    };

    insertJob(db, job, request.user.id, status);
    const saved = rowToJob(db.prepare("SELECT * FROM jobs WHERE id = ?").get(id));
    response.status(201).json({ job: employerJobWithCounts(saved, new Map()) });
  });

  router.patch("/jobs/:jobId", (request, response) => {
    const job = db
      .prepare("SELECT * FROM jobs WHERE id = ? AND owner_id = ?")
      .get(request.params.jobId, request.user.id);
    if (!job) {
      sendError(response, 404, "JOB_NOT_FOUND", "Employer job post not found.");
      return;
    }
    const status = request.body?.status;
    if (!status || !["draft", "active", "closed"].includes(status)) {
      sendError(response, 400, "VALIDATION_ERROR", "Choose draft, active, or closed.", {
        status: "Choose a valid job status.",
      });
      return;
    }
    const source = JSON.parse(job.source_json);
    const now = new Date().toISOString();
    let closingAt = job.closing_at;
    if (status === "active") {
      const normalizedClosingAt = normalizeClosingAt(
        request.body?.closingAt ?? job.closing_at,
      );
      if (!normalizedClosingAt.value) {
        sendError(
          response,
          400,
          "VALIDATION_ERROR",
          "Set a future application deadline before publishing.",
          {
            closingAt:
              normalizedClosingAt.error ||
              "Choose an application deadline before publishing.",
          },
        );
        return;
      }
      closingAt = normalizedClosingAt.value;
      if (!source.publishedAt) source.publishedAt = now;
    }
    db.prepare(`
      UPDATE jobs
      SET status = ?, closing_at = ?, source_json = ?, updated_at = ?
      WHERE id = ? AND owner_id = ?
    `).run(
      status,
      closingAt,
      JSON.stringify(source),
      now,
      job.id,
      request.user.id,
    );
    const saved = rowToJob(db.prepare("SELECT * FROM jobs WHERE id = ?").get(job.id));
    const { countsByJob } = employerApplicationSummary(db, request.user.id, [saved]);
    response.json({ job: employerJobWithCounts(saved, countsByJob) });
  });

  router.get("/jobs/:jobId/applications", (request, response) => {
    const job = rowToJob(
      db
        .prepare("SELECT * FROM jobs WHERE id = ? AND owner_id = ?")
        .get(request.params.jobId, request.user.id),
    );
    if (!job) {
      sendError(response, 404, "JOB_NOT_FOUND", "Employer job post not found.");
      return;
    }
    const applications = db.prepare(`
      SELECT * FROM applications
      WHERE job_id = ?
      ORDER BY submitted_at DESC
    `).all(job.id).map((application) => ({
      id: application.id,
      jobId: application.job_id,
      applicant: {
        fullName: application.full_name,
        email: application.email,
        mobileNumber: application.mobile_number,
      },
      resume: {
        name: application.resume_name,
        sizeBytes: application.resume_size_bytes,
        type: application.resume_type,
        available: Boolean(application.resume_path),
      },
      message: application.message,
      status: application.status,
      submittedAt: application.submitted_at,
      fit: candidateMatch(db, application.applicant_id, job),
    }));
    const countsByJob = new Map([
      [
        job.id,
        {
          applicantCount: applications.length,
          newApplicantCount: applications.filter(
            (application) => application.status === "Submitted",
          ).length,
          strongMatchCount: applications.filter(
            (application) =>
              (application.fit?.overallScore ?? -1) >= STRONG_MATCH_THRESHOLD,
          ).length,
        },
      ],
    ]);
    response.json({
      job: employerJobWithCounts(job, countsByJob),
      applications,
    });
  });

  router.patch("/applications/:applicationId/status", (request, response) => {
    const status = request.body?.status;
    if (!APPLICATION_STATUSES.includes(status)) {
      sendError(response, 400, "VALIDATION_ERROR", "Choose a valid application status.", {
        status: "Choose Submitted, Under review, Shortlisted, or Not selected.",
      });
      return;
    }
    const application = db.prepare(`
      SELECT applications.*
      FROM applications
      JOIN jobs ON jobs.id = applications.job_id
      WHERE applications.id = ? AND jobs.owner_id = ?
    `).get(request.params.applicationId, request.user.id);
    if (!application) {
      sendError(response, 404, "APPLICATION_NOT_FOUND", "Application not found.");
      return;
    }
    const now = new Date().toISOString();
    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE applications SET status = ?, updated_at = ? WHERE id = ?
      `).run(status, now, application.id);
      db.prepare(`
        INSERT INTO application_status_history
          (application_id, status, changed_by, changed_at)
        VALUES (?, ?, ?, ?)
      `).run(application.id, status, request.user.id, now);
    });
    transaction();
    response.json({ applicationId: application.id, status, updatedAt: now });
  });

  router.get("/company", (request, response) => {
    const company = db
      .prepare("SELECT * FROM company_profiles WHERE user_id = ?")
      .get(request.user.id);
    response.json({
      company: companyResponse(company, request.user.display_name),
    });
  });

  router.put("/company", (request, response) => {
    const companyName = requiredText(request.body?.companyName, 140);
    const description = optionalText(request.body?.description, 2000);
    const website = optionalText(request.body?.website, 300);
    const city = optionalText(request.body?.city, 100);
    const province = optionalText(request.body?.province, 100);
    const details = {
      industry: optionalText(request.body?.industry, 120),
      size: optionalText(request.body?.size, 80),
      email: optionalText(request.body?.email, 254).toLowerCase(),
      phone: optionalText(request.body?.phone, 40),
      street: optionalText(request.body?.street, 180),
      barangay: optionalText(request.body?.barangay, 100),
      city: city || "Angeles City",
      province: province || "Pampanga",
      benefits: optionalText(request.body?.benefits, 3000),
    };
    const fields = {};
    if (!companyName) fields.companyName = "Enter the company name.";
    if (website && !validHttpUrl(website)) {
      fields.website = "Enter a complete HTTP or HTTPS website address.";
    }
    if (details.email && !validEmail(details.email)) {
      fields.email = "Enter a valid hiring email address.";
    }
    if (Object.keys(fields).length) {
      sendError(response, 400, "VALIDATION_ERROR", "Check the highlighted fields.", fields);
      return;
    }

    const hasStructuredAddress = Boolean(
      details.street || details.barangay || city || province,
    );
    const address = hasStructuredAddress
      ? [details.street, details.barangay, details.city, details.province]
          .filter(Boolean)
          .join(", ")
      : optionalText(request.body?.address, 500) ||
        [details.city, details.province].join(", ");
    const now = new Date().toISOString();
    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO company_profiles (
          user_id, company_name, description, address, website,
          details_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          company_name = excluded.company_name,
          description = excluded.description,
          address = excluded.address,
          website = excluded.website,
          details_json = excluded.details_json,
          updated_at = excluded.updated_at
      `).run(
        request.user.id,
        companyName,
        description,
        address,
        website,
        JSON.stringify(details),
        now,
      );

      const jobs = db
        .prepare("SELECT id, source_json FROM jobs WHERE owner_id = ?")
        .all(request.user.id);
      const updateJobIdentity = db.prepare(`
        UPDATE jobs
        SET employer_name = ?, source_json = ?, updated_at = ?
        WHERE id = ? AND owner_id = ?
      `);
      for (const job of jobs) {
        const source = JSON.parse(job.source_json);
        if (source.origin !== "direct-employer") continue;
        source.organizationName = companyName;
        updateJobIdentity.run(
          companyName,
          JSON.stringify(source),
          now,
          job.id,
          request.user.id,
        );
      }
    });
    transaction();

    const company = db
      .prepare("SELECT * FROM company_profiles WHERE user_id = ?")
      .get(request.user.id);
    response.json({
      company: companyResponse(company, request.user.display_name),
    });
  });

  return router;
}
