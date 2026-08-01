import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../auth.js";
import { ensureSkill, isJobAvailable, rowToJob } from "../db.js";
import {
  createId,
  optionalText,
  requiredText,
  sendError,
  stringArray,
  validEmail,
} from "../http.js";
import { getUserMatch, isMatchingProfileComplete } from "../matching.js";

function profileResponse(db, userId) {
  const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId);
  const skills = db.prepare(`
    SELECT skills.id, skills.name, user_skills.source
    FROM user_skills
    JOIN skills ON skills.id = user_skills.skill_id
    WHERE user_skills.user_id = ?
    ORDER BY skills.name
  `).all(userId);
  return {
    isComplete: isMatchingProfileComplete(db, profile, skills),
    fullName: profile.full_name,
    mobileNumber: profile.mobile_number,
    barangay: profile.barangay,
    city: profile.city,
    homeNodeId: profile.home_node_id,
    preferredWorkTypes: JSON.parse(profile.preferred_work_types_json),
    skills,
    updatedAt: profile.updated_at,
  };
}

function applicationResponse(row) {
  return {
    id: row.id,
    jobId: row.job_id,
    jobTitle: row.job_title,
    employerName: row.employer_name,
    location: row.location_json ? JSON.parse(row.location_json) : undefined,
    fullName: row.full_name,
    email: row.email,
    mobileNumber: row.mobile_number,
    resume: {
      name: row.resume_name,
      sizeBytes: row.resume_size_bytes,
      type: row.resume_type,
      available: Boolean(row.resume_path),
    },
    message: row.message,
    status: row.status,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  };
}

export function createAccountRouter(db, uploadsDirectory) {
  mkdirSync(uploadsDirectory, { recursive: true });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_request, file, callback) => {
      if (file.mimetype !== "application/pdf") {
        const error = new Error("Only PDF resumes are accepted.");
        error.code = "INVALID_FILE_TYPE";
        callback(error);
        return;
      }
      callback(null, true);
    },
  });
  const router = Router();

  router.get("/profile", requireRole("job-seeker"), (request, response) => {
    response.json({ profile: profileResponse(db, request.user.id) });
  });

  router.put("/profile", requireRole("job-seeker"), (request, response) => {
    const fullName = requiredText(request.body?.fullName, 100);
    const mobileNumber = optionalText(request.body?.mobileNumber, 30);
    const barangay = requiredText(request.body?.barangay, 100);
    const city = requiredText(request.body?.city, 100) || "Angeles City";
    const homeNodeId = requiredText(request.body?.homeNodeId, 80) || "balibago";
    const preferredWorkTypes = stringArray(request.body?.preferredWorkTypes, 5, 40);
    const fields = {};

    if (!fullName) fields.fullName = "Enter your full name.";
    if (!barangay) fields.barangay = "Enter your barangay.";
    if (!db.prepare("SELECT 1 FROM geo_nodes WHERE id = ?").get(homeNodeId)) {
      fields.homeNodeId = "Choose a supported starting area.";
    }
    if (Object.keys(fields).length) {
      sendError(response, 400, "VALIDATION_ERROR", "Check the highlighted fields.", fields);
      return;
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE profiles SET
        full_name = ?, mobile_number = ?, barangay = ?, city = ?,
        home_node_id = ?, preferred_work_types_json = ?, updated_at = ?
      WHERE user_id = ?
    `).run(
      fullName,
      mobileNumber,
      barangay,
      city,
      homeNodeId,
      JSON.stringify(preferredWorkTypes),
      now,
      request.user.id,
    );
    response.json({ profile: profileResponse(db, request.user.id) });
  });

  router.put("/profile/skills", requireRole("job-seeker"), (request, response) => {
    const names = stringArray(request.body?.skills, 10, 80);
    if (!names.length) {
      sendError(response, 400, "VALIDATION_ERROR", "Add at least one skill.", {
        skills: "Choose at least one skill.",
      });
      return;
    }

    const insertUserSkill = db.prepare(`
      INSERT INTO user_skills (user_id, skill_id, source)
      VALUES (?, ?, 'self-reported')
    `);
    const transaction = db.transaction(() => {
      db.prepare("DELETE FROM user_skills WHERE user_id = ?").run(request.user.id);
      const insertedIds = new Set();
      for (const name of names) {
        const skill = ensureSkill(db, name);
        if (insertedIds.has(skill.id)) continue;
        insertUserSkill.run(request.user.id, skill.id);
        insertedIds.add(skill.id);
      }
    });
    transaction();
    response.json({ profile: profileResponse(db, request.user.id) });
  });

  router.get("/saved-jobs", requireRole("job-seeker"), (request, response) => {
    const jobs = db.prepare(`
      SELECT jobs.*
      FROM saved_jobs
      JOIN jobs ON jobs.id = saved_jobs.job_id
      WHERE saved_jobs.user_id = ?
      ORDER BY saved_jobs.saved_at DESC
    `)
      .all(request.user.id)
      .map(rowToJob)
      .filter((job) => isJobAvailable(job));
    response.json({
      jobs: jobs.map((job) => ({ ...job, fit: getUserMatch(db, request.user.id, job) })),
    });
  });

  router.post("/saved-jobs/:jobId", requireRole("job-seeker"), (request, response) => {
    const job = rowToJob(
      db.prepare("SELECT * FROM jobs WHERE id = ?").get(request.params.jobId),
    );
    if (!isJobAvailable(job)) {
      sendError(response, 404, "JOB_NOT_FOUND", "This job is no longer available.");
      return;
    }
    db.prepare(`
      INSERT OR IGNORE INTO saved_jobs (user_id, job_id, saved_at)
      VALUES (?, ?, ?)
    `).run(request.user.id, job.id, new Date().toISOString());
    response.status(201).json({ saved: true, jobId: job.id });
  });

  router.delete("/saved-jobs/:jobId", requireRole("job-seeker"), (request, response) => {
    db.prepare("DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?").run(
      request.user.id,
      request.params.jobId,
    );
    response.status(204).end();
  });

  router.get("/applications", requireRole("job-seeker"), (request, response) => {
    const rows = db.prepare(`
      SELECT applications.*, jobs.title AS job_title, jobs.employer_name,
             jobs.location_json
      FROM applications
      JOIN jobs ON jobs.id = applications.job_id
      WHERE applications.applicant_id = ?
      ORDER BY applications.submitted_at DESC
    `).all(request.user.id);
    response.json({ applications: rows.map(applicationResponse) });
  });

  router.post(
    "/applications",
    requireRole("job-seeker"),
    upload.single("resume"),
    (request, response) => {
      const jobId = requiredText(request.body?.jobId, 120);
      const job = rowToJob(
        db
          .prepare("SELECT * FROM jobs WHERE id = ?")
          .get(jobId),
      );
      if (!isJobAvailable(job)) {
        sendError(response, 404, "JOB_NOT_FOUND", "This job is no longer available.");
        return;
      }
      if (job.source.applicationMethod !== "jobfinder") {
        response.status(409).json({
          error: {
            code: "EXTERNAL_APPLICATION_METHOD",
            message: "Use the application method supplied by the source record.",
          },
          applicationMethod: job.source.applicationMethod,
          applicationTarget: job.source.applicationTarget,
          applicationInstructions: job.source.applicationInstructions,
        });
        return;
      }

      const fullName = requiredText(request.body?.fullName, 100);
      const email = requiredText(request.body?.email, 254).toLowerCase();
      const mobileNumber = requiredText(request.body?.mobileNumber, 30);
      const message = optionalText(request.body?.message, 2000);
      const resumeName = request.file?.originalname ?? "";
      const resumeSizeBytes = request.file?.size ?? null;
      const resumeType = request.file?.mimetype ?? "";
      const hasPdfSignature =
        request.file?.buffer.subarray(0, 5).toString("ascii") === "%PDF-";
      const fields = {};

      if (!fullName) fields.fullName = "Enter your full name.";
      if (!validEmail(email)) fields.email = "Enter a valid email address.";
      if (!mobileNumber) fields.mobileNumber = "Enter your mobile number.";
      if (
        !request.file ||
        !resumeName ||
        resumeSizeBytes === null ||
        resumeType !== "application/pdf" ||
        !hasPdfSignature
      ) {
        fields.resume = "Attach one PDF resume up to 5 MB.";
      }
      if (Object.keys(fields).length) {
        sendError(response, 400, "VALIDATION_ERROR", "Check the highlighted fields.", fields);
        return;
      }

      const now = new Date().toISOString();
      const applicationId = createId("application");
      const resumePath = request.file
        ? path.join(uploadsDirectory, `${createId("resume")}.pdf`)
        : null;
      if (request.file && resumePath) writeFileSync(resumePath, request.file.buffer);
      try {
        const transaction = db.transaction(() => {
          db.prepare(`
            INSERT INTO applications (
              id, job_id, applicant_id, full_name, email, mobile_number,
              resume_name, resume_size_bytes, resume_type, resume_path,
              message, status, submitted_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', ?, ?)
          `).run(
            applicationId,
            job.id,
            request.user.id,
            fullName,
            email,
            mobileNumber,
            resumeName,
            resumeSizeBytes,
            resumeType,
            resumePath,
            message,
            now,
            now,
          );
          db.prepare(`
            INSERT INTO application_status_history
              (application_id, status, changed_by, changed_at)
            VALUES (?, 'Submitted', ?, ?)
          `).run(applicationId, request.user.id, now);
        });
        transaction();
      } catch (error) {
        if (resumePath && existsSync(resumePath)) unlinkSync(resumePath);
        if (String(error?.code).startsWith("SQLITE_CONSTRAINT")) {
          sendError(response, 409, "ALREADY_APPLIED", "You already applied to this job.");
          return;
        }
        throw error;
      }

      const row = db.prepare(`
        SELECT applications.*, jobs.title AS job_title, jobs.employer_name,
               jobs.location_json
        FROM applications
        JOIN jobs ON jobs.id = applications.job_id
        WHERE applications.id = ?
      `).get(applicationId);
      response.status(201).json({ application: applicationResponse(row) });
    },
  );

  router.get("/applications/:applicationId/resume", requireAuth, (request, response) => {
    const row = db.prepare(`
      SELECT applications.*, jobs.owner_id
      FROM applications
      JOIN jobs ON jobs.id = applications.job_id
      WHERE applications.id = ?
    `).get(request.params.applicationId);
    if (!row) {
      sendError(response, 404, "APPLICATION_NOT_FOUND", "Application not found.");
      return;
    }
    if (row.applicant_id !== request.user.id && row.owner_id !== request.user.id) {
      sendError(response, 403, "APPLICATION_FORBIDDEN", "You cannot open this resume.");
      return;
    }
    if (!row.resume_path || !existsSync(row.resume_path)) {
      sendError(response, 404, "RESUME_NOT_STORED", "No uploaded resume file is available.");
      return;
    }
    const resolvedUploads = path.resolve(uploadsDirectory);
    const resolvedResume = path.resolve(row.resume_path);
    if (!resolvedResume.startsWith(`${resolvedUploads}${path.sep}`)) {
      sendError(response, 403, "INVALID_RESUME_PATH", "The resume path is invalid.");
      return;
    }
    response.download(resolvedResume, row.resume_name);
  });

  return router;
}
