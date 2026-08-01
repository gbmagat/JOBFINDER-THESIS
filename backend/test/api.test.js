import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { createApp } from "../src/app.js";
import { createDatabase } from "../src/db.js";

let db;
let server;
let baseUrl;
let temporaryDirectory;

beforeEach(async () => {
  db = createDatabase(":memory:", { seedDemo: true });
  temporaryDirectory = mkdtempSync(path.join(tmpdir(), "jobfinder-api-"));
  const app = createApp({
    db,
    uploadsDirectory: path.join(temporaryDirectory, "uploads"),
  });
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

async function request(pathname, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      ...(options.body && !isFormData
        ? { "content-type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

function applicationForm(
  {
    jobId,
    fullName,
    email,
    mobileNumber,
    message = "",
    resumeName = "resume.pdf",
  },
  {
    resumeType = "application/pdf",
    resumeContents = "%PDF-1.4\n% JobFinder test resume\n",
  } = {},
) {
  const form = new FormData();
  form.set("jobId", jobId);
  form.set("fullName", fullName);
  form.set("email", email);
  form.set("mobileNumber", mobileNumber);
  form.set("message", message);
  form.set(
    "resume",
    new Blob([resumeContents], { type: resumeType }),
    resumeName,
  );
  return form;
}

async function register(role, email) {
  const result = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "correct-horse-battery",
      displayName: role === "employer" ? "Test Company" : "Test Seeker",
      role,
    }),
  });
  assert.equal(result.response.status, 201);
  return {
    user: result.body.user,
    cookie: result.response.headers.get("set-cookie").split(";")[0],
  };
}

test("public jobs never expose a guest match score", async () => {
  const health = await request("/api/health");
  assert.equal(health.response.status, 200);

  const result = await request("/api/jobs");
  assert.equal(result.response.status, 200);
  assert.equal(result.body.jobs.length, 3);
  assert.equal("fit" in result.body.jobs[0], false);
  const directJob = result.body.jobs.find(
    (job) => job.id === "it-support-assistant-lumina-tech",
  );
  assert.equal("ownerId" in directJob.source, false);
});

test("protected account routes require a signed-in job seeker", async () => {
  const guest = await request("/api/profile");
  assert.equal(guest.response.status, 401);
  assert.equal(guest.body.error.code, "AUTH_REQUIRED");

  const employer = await register("employer", "role-check@example.com");
  const wrongRole = await request("/api/profile", {
    headers: { cookie: employer.cookie },
  });
  assert.equal(wrongRole.response.status, 403);
  assert.equal(wrongRole.body.error.code, "ROLE_REQUIRED");
});

test("a seeker profile enables explainable ontology and location scores", async () => {
  const seeker = await register("job-seeker", "match@example.com");
  const headers = { cookie: seeker.cookie };

  const profile = await request("/api/profile", {
    method: "PUT",
    headers,
    body: JSON.stringify({
      fullName: "Test Seeker",
      mobileNumber: "09171234567",
      barangay: "Balibago",
      city: "Angeles City",
      maximumDistanceKm: 10,
      maximumMinutes: 35,
      homeNodeId: "balibago",
      preferredWorkTypes: ["Full-time"],
    }),
  });
  assert.equal(profile.response.status, 200);

  const skills = await request("/api/profile/skills", {
    method: "PUT",
    headers,
    body: JSON.stringify({
      skills: ["Troubleshooting", "Customer support", "Computer networking"],
    }),
  });
  assert.equal(skills.response.status, 200);

  const result = await request("/api/jobs/it-support-assistant-lumina-tech", {
    headers,
  });
  assert.equal(result.response.status, 200);
  assert.equal(typeof result.body.job.fit.overallScore, "number");
  assert.equal(result.body.job.fit.weights.skill, 0.7);
  assert.equal(result.body.job.fit.weights.location, 0.3);
  assert.ok(result.body.job.fit.relatedSkills.length >= 1);
  assert.equal(result.body.job.fit.route.accessibilityStatus, "within-limit");
});

test("profile skills keep C, C sharp, and C plus plus distinct", async () => {
  const seeker = await register("job-seeker", "skill-ids@example.com");
  const result = await request("/api/profile/skills", {
    method: "PUT",
    headers: { cookie: seeker.cookie },
    body: JSON.stringify({ skills: ["C#", "C++", "C", "Java", "java"] }),
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.body.profile.skills.length, 4);
  assert.equal(new Set(result.body.profile.skills.map((skill) => skill.id)).size, 4);
  assert.deepEqual(
    new Set(result.body.profile.skills.map((skill) => skill.name.toLowerCase())),
    new Set(["c#", "c++", "c", "java"]),
  );
});

test("PESO and LGU listings preserve their external application method", async () => {
  const seeker = await register("job-seeker", "external@example.com");
  const result = await request("/api/applications", {
    method: "POST",
    headers: { cookie: seeker.cookie },
    body: applicationForm({
      jobId: "customer-service-associate-clarkconnect",
      fullName: "Test Seeker",
      email: "external@example.com",
      mobileNumber: "09171234567",
    }),
  });
  assert.equal(result.response.status, 409);
  assert.equal(result.body.error.code, "EXTERNAL_APPLICATION_METHOD");
  assert.equal(result.body.applicationMethod, "email");
});

test("an employer can publish a job and review its submitted application", async () => {
  const employer = await register("employer", "owner@example.com");
  const created = await request("/api/employer/jobs", {
    method: "POST",
    headers: { cookie: employer.cookie },
    body: JSON.stringify({
      title: "Help Desk Assistant",
      summary: "Support local office users.",
      description: "Resolve common workstation and account concerns.",
      employmentType: "Full-time",
      workArrangement: "On-site",
      geoNodeId: "nepo-center",
      venue: "Test Company Office",
      barangay: "Sto. Rosario",
      requiredSkills: ["Technical support"],
      preferredSkills: ["Customer support"],
      salaryMinimumPhp: 19000,
      salaryMaximumPhp: 23000,
      status: "active",
    }),
  });
  assert.equal(created.response.status, 201);
  const jobId = created.body.job.id;

  const seeker = await register("job-seeker", "applicant@example.com");
  const seekerHeaders = { cookie: seeker.cookie };
  await request("/api/profile", {
    method: "PUT",
    headers: seekerHeaders,
    body: JSON.stringify({
      fullName: "Applicant One",
      mobileNumber: "09175550123",
      barangay: "Balibago",
      city: "Angeles City",
      maximumDistanceKm: 10,
      maximumMinutes: 35,
      homeNodeId: "balibago",
      preferredWorkTypes: ["Full-time"],
    }),
  });
  await request("/api/profile/skills", {
    method: "PUT",
    headers: seekerHeaders,
    body: JSON.stringify({ skills: ["Technical support"] }),
  });
  const submitted = await request("/api/applications", {
    method: "POST",
    headers: seekerHeaders,
    body: applicationForm({
      jobId,
      fullName: "Applicant One",
      email: "applicant@example.com",
      mobileNumber: "09175550123",
      resumeName: "applicant-one.pdf",
      message: "I am interested in this role.",
    }),
  });
  assert.equal(submitted.response.status, 201);
  const applicationId = submitted.body.application.id;

  const inbox = await request(`/api/employer/jobs/${jobId}/applications`, {
    headers: { cookie: employer.cookie },
  });
  assert.equal(inbox.response.status, 200);
  assert.equal(inbox.body.applications.length, 1);
  assert.equal(inbox.body.applications[0].applicant.fullName, "Applicant One");

  const overview = await request("/api/employer/overview", {
    headers: { cookie: employer.cookie },
  });
  const overviewJob = overview.body.jobs.find((job) => job.id === jobId);
  assert.equal(overviewJob.applicantCount, 1);
  assert.equal(overviewJob.newApplicantCount, 1);
  assert.equal(overviewJob.strongMatchCount, 1);
  assert.equal(overview.body.metrics.applicants, 1);
  assert.equal(overview.body.metrics.newToReview, 1);
  assert.equal(overview.body.metrics.strongMatches, 1);
  assert.equal(overview.body.recentActivity[0].applicantName, "Applicant One");
  assert.equal(overview.body.recentActivity[0].jobId, jobId);
  assert.ok(overview.body.recentActivity[0].overallScore >= 85);

  const employerJobs = await request("/api/employer/jobs", {
    headers: { cookie: employer.cookie },
  });
  const listedJob = employerJobs.body.jobs.find((job) => job.id === jobId);
  assert.equal(listedJob.applicantCount, 1);
  assert.equal(listedJob.newApplicantCount, 1);
  assert.equal(listedJob.strongMatchCount, 1);

  const reviewed = await request(
    `/api/employer/applications/${applicationId}/status`,
    {
      method: "PATCH",
      headers: { cookie: employer.cookie },
      body: JSON.stringify({ status: "Shortlisted" }),
    },
  );
  assert.equal(reviewed.response.status, 200);

  const reviewedOverview = await request("/api/employer/overview", {
    headers: { cookie: employer.cookie },
  });
  const reviewedJob = reviewedOverview.body.jobs.find((job) => job.id === jobId);
  assert.equal(reviewedJob.applicantCount, 1);
  assert.equal(reviewedJob.newApplicantCount, 0);
  assert.equal(reviewedJob.strongMatchCount, 1);
  assert.equal(reviewedOverview.body.metrics.newToReview, 0);

  const applications = await request("/api/applications", {
    headers: seekerHeaders,
  });
  assert.equal(applications.body.applications[0].status, "Shortlisted");
});

test("applications require a real PDF upload and upload errors stay client errors", async () => {
  const seeker = await register("job-seeker", "resume-check@example.com");
  const headers = { cookie: seeker.cookie };
  const application = {
    jobId: "it-support-assistant-lumina-tech",
    fullName: "Resume Check",
    email: "resume-check@example.com",
    mobileNumber: "09170000001",
  };

  const missingFile = await request("/api/applications", {
    method: "POST",
    headers,
    body: JSON.stringify(application),
  });
  assert.equal(missingFile.response.status, 400);
  assert.equal(missingFile.body.error.fields.resume.includes("PDF"), true);

  const falsePdf = await request("/api/applications", {
    method: "POST",
    headers,
    body: applicationForm(application, { resumeContents: "not a PDF" }),
  });
  assert.equal(falsePdf.response.status, 400);
  assert.equal(falsePdf.body.error.fields.resume.includes("PDF"), true);

  const wrongType = await request("/api/applications", {
    method: "POST",
    headers,
    body: applicationForm(application, {
      resumeType: "text/plain",
      resumeContents: "plain text",
    }),
  });
  assert.equal(wrongType.response.status, 400);
  assert.equal(wrongType.body.error.code, "INVALID_UPLOAD");

  const invalidJson = await request("/api/auth/login", {
    method: "POST",
    body: "{",
  });
  assert.equal(invalidJson.response.status, 400);
  assert.equal(invalidJson.body.error.code, "INVALID_JSON");
});

test("expired jobs are unavailable in public, saved, and application routes", async () => {
  const employer = await register("employer", "expired-owner@example.com");
  const created = await request("/api/employer/jobs", {
    method: "POST",
    headers: { cookie: employer.cookie },
    body: JSON.stringify({
      title: "Expired Support Role",
      summary: "This listing has already closed.",
      description: "A test listing used to verify closing-date behavior.",
      employmentType: "Full-time",
      workArrangement: "On-site",
      geoNodeId: "nepo-center",
      requiredSkills: ["Technical support"],
      salaryMinimumPhp: 18000,
      salaryMaximumPhp: 22000,
      closingAt: "2020-01-01T00:00:00.000Z",
      status: "active",
    }),
  });
  assert.equal(created.response.status, 201);
  const jobId = created.body.job.id;

  const detail = await request(`/api/jobs/${jobId}`);
  assert.equal(detail.response.status, 404);
  const publicJobs = await request("/api/jobs?pageSize=50");
  assert.equal(publicJobs.body.jobs.some((job) => job.id === jobId), false);

  const seeker = await register("job-seeker", "expired-seeker@example.com");
  const headers = { cookie: seeker.cookie };
  db.prepare(`
    INSERT INTO saved_jobs (user_id, job_id, saved_at) VALUES (?, ?, ?)
  `).run(seeker.user.id, jobId, new Date().toISOString());

  const saved = await request("/api/saved-jobs", { headers });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.body.jobs.some((job) => job.id === jobId), false);

  const saveAttempt = await request(`/api/saved-jobs/${jobId}`, {
    method: "POST",
    headers,
  });
  assert.equal(saveAttempt.response.status, 404);

  const applicationAttempt = await request("/api/applications", {
    method: "POST",
    headers,
    body: applicationForm({
      jobId,
      fullName: "Expired Seeker",
      email: "expired-seeker@example.com",
      mobileNumber: "09170000002",
    }),
  });
  assert.equal(applicationAttempt.response.status, 404);
});
