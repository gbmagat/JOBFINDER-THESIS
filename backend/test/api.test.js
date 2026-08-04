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
const demoAccounts = {
  employerEmail: "employer-test@example.com",
  jobSeekerEmail: "seeker-test@example.com",
  pesoLguEmail: "lgu-test@example.com",
  password: "test-password-123",
};

beforeEach(async () => {
  db = createDatabase(":memory:", { seedDemo: true, demoAccounts });
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

async function signIn(email, password = demoAccounts.password) {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assert.equal(result.response.status, 200);
  return {
    user: result.body.user,
    cookie: result.response.headers.get("set-cookie").split(";")[0],
  };
}

async function approveJob(jobId) {
  const reviewer = await signIn(demoAccounts.pesoLguEmail);
  const review = await request(`/api/lgu/verification/jobs/${jobId}`, {
    headers: { cookie: reviewer.cookie },
  });
  assert.equal(review.response.status, 200);
  if (review.body.employer.verification.status !== "verified") {
    const verification = await request(
      `/api/lgu/employers/${review.body.employer.id}/decision`,
      {
        method: "POST",
        headers: { cookie: reviewer.cookie },
        body: JSON.stringify({ decision: "approve" }),
      },
    );
    assert.equal(verification.response.status, 200);
  }
  const result = await request(`/api/lgu/verification/jobs/${jobId}/decision`, {
    method: "POST",
    headers: { cookie: reviewer.cookie },
    body: JSON.stringify({ decision: "approve", note: "Job details verified." }),
  });
  assert.equal(result.response.status, 200);
  return result.body.job;
}

function futureDeadline(days = 30) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function assertDistanceOnlyRoute(route) {
  assert.equal(typeof route.distanceKm, "number");
  assert.equal("estimatedMinutes" in route, false);
  assert.equal("accessibilityStatus" in route, false);
  assert.equal(
    route.steps.some((step) => "estimatedMinutes" in step),
    false,
  );
}

function assertDijkstraLineString(route) {
  assert.equal(route.algorithm, "dijkstra");
  assert.equal(route.geometry.type, "LineString");
  assert.ok(route.geometry.coordinates.length >= 2);
  for (const coordinate of route.geometry.coordinates) {
    assert.equal(coordinate.length, 2);
    const [longitude, latitude] = coordinate;
    assert.ok(Number.isFinite(longitude));
    assert.ok(Number.isFinite(latitude));
    assert.ok(longitude >= -180 && longitude <= 180);
    assert.ok(latitude >= -90 && latitude <= 90);
  }
}

test("development demo accounts can sign in", async () => {
  const accounts = [
    { email: demoAccounts.employerEmail, role: "employer" },
    { email: demoAccounts.jobSeekerEmail, role: "job-seeker" },
    { email: demoAccounts.pesoLguEmail, role: "peso-lgu" },
  ];

  for (const account of accounts) {
    const result = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: account.email,
        password: demoAccounts.password,
      }),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.user.email, account.email);
    assert.equal(result.body.user.role, account.role);

    if (account.role === "job-seeker") {
      const cookie = result.response.headers.get("set-cookie").split(";")[0];
      const profile = await request("/api/profile", {
        headers: { cookie },
      });
      assert.equal(profile.response.status, 200);
      assert.equal(profile.body.profile.homeNodeId, "balibago");
      assert.equal(profile.body.profile.skills.length, 10);
      assert.equal("maximumDistanceKm" in profile.body.profile, false);
      assert.equal("maximumMinutes" in profile.body.profile, false);

      const jobs = await request("/api/jobs", {
        headers: { cookie },
      });
      assert.equal(jobs.response.status, 200);
      assert.equal(jobs.body.jobs.length, 3);
      assert.equal(typeof jobs.body.jobs[0].fit.overallScore, "number");
      jobs.body.jobs.forEach((job) => assertDistanceOnlyRoute(job.route));
    }
  }
});

test("the PESO/LGU role is internally provisioned and protects its workspace", async () => {
  const publicRegistration = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: "public-reviewer@example.com",
      password: "correct-horse-battery",
      displayName: "Public Reviewer",
      role: "peso-lgu",
    }),
  });
  assert.equal(publicRegistration.response.status, 400);
  assert.match(publicRegistration.body.error.fields.role, /Job Seeker or Employer/);

  const guest = await request("/api/lgu/overview");
  assert.equal(guest.response.status, 401);

  const employer = await register("employer", "lgu-role-check@example.com");
  const wrongRole = await request("/api/lgu/overview", {
    headers: { cookie: employer.cookie },
  });
  assert.equal(wrongRole.response.status, 403);

  const reviewer = await signIn(demoAccounts.pesoLguEmail);
  assert.equal(reviewer.user.role, "peso-lgu");
  const overview = await request("/api/lgu/overview", {
    headers: { cookie: reviewer.cookie },
  });
  assert.equal(overview.response.status, 200);
  assert.ok(Array.isArray(overview.body.metrics));
  assert.equal(typeof overview.body.metrics[0].value, "number");
  assert.ok(Array.isArray(overview.body.recentActivity));
  assert.ok(overview.body.priorities);
});

test("pending employer jobs require PESO/LGU approval and decisions are audited", async () => {
  const employer = await register("employer", "pending-owner@example.com");
  const created = await request("/api/employer/jobs", {
    method: "POST",
    headers: { cookie: employer.cookie },
    body: JSON.stringify({
      title: "Pending Review Role",
      summary: "This job must be reviewed before public browsing.",
      description: "A complete employer listing awaiting PESO/LGU review.",
      employmentType: "Full-time",
      workArrangement: "On-site",
      geoNodeId: "nepo-center",
      requiredSkills: ["Verification Testing"],
      salaryMinimumPhp: 20000,
      salaryMaximumPhp: 25000,
      closingAt: futureDeadline(),
      status: "active",
    }),
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.job.status, "draft");
  assert.equal(created.body.job.reviewStatus, "pending");

  const hidden = await request(`/api/jobs/${created.body.job.id}`);
  assert.equal(hidden.response.status, 404);

  const reviewer = await signIn(demoAccounts.pesoLguEmail);
  const headers = { cookie: reviewer.cookie };
  const queue = await request("/api/lgu/verification", { headers });
  assert.equal(queue.response.status, 200);
  assert.ok(queue.body.items.some((job) => job.id === created.body.job.id));
  assert.equal(typeof queue.body.items[0].jobTitle, "string");

  const review = await request(
    `/api/lgu/verification/jobs/${created.body.job.id}`,
    { headers },
  );
  assert.equal(review.response.status, 200);
  assert.equal(review.body.job.id, created.body.job.id);
  assert.equal(review.body.employer.id, employer.user.id);
  assert.ok(Array.isArray(review.body.evidence));

  const employers = await request("/api/lgu/employers", { headers });
  assert.equal(employers.response.status, 200);
  const employerRecord = employers.body.employers.find(
    (record) => record.id === employer.user.id,
  );
  assert.equal(employerRecord.name, "Test Company");
  assert.equal(employerRecord.status, "Pending Review");

  const employerDetail = await request(`/api/lgu/employers/${employer.user.id}`, {
    headers,
  });
  assert.equal(employerDetail.response.status, 200);
  assert.ok(Array.isArray(employerDetail.body.checklist));
  assert.ok(Array.isArray(employerDetail.body.evidence));

  const missingEmployerNote = await request(
    `/api/lgu/employers/${employer.user.id}/decision`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ decision: "request-changes" }),
    },
  );
  assert.equal(missingEmployerNote.response.status, 400);

  const unverifiedEmployerApproval = await request(
    `/api/lgu/verification/jobs/${created.body.job.id}/decision`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ decision: "approve" }),
    },
  );
  assert.equal(unverifiedEmployerApproval.response.status, 409);
  assert.equal(
    unverifiedEmployerApproval.body.error.code,
    "EMPLOYER_NOT_VERIFIED",
  );

  const requestedEmployerChanges = await request(
    `/api/lgu/employers/${employer.user.id}/decision`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        decision: "request-changes",
        note: "Provide an updated workplace record.",
      }),
    },
  );
  assert.equal(requestedEmployerChanges.response.status, 200);
  const highRiskQueue = await request("/api/lgu/verification", { headers });
  assert.equal(
    highRiskQueue.body.items.find((job) => job.id === created.body.job.id)
      .riskLevel,
    "high",
  );

  const verifiedEmployer = await request(
    `/api/lgu/employers/${employer.user.id}/decision`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ decision: "approve" }),
    },
  );
  assert.equal(verifiedEmployer.response.status, 200);
  assert.equal(verifiedEmployer.body.employer.verification.status, "verified");

  const missingJobNote = await request(
    `/api/lgu/verification/jobs/${created.body.job.id}/decision`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ decision: "request-changes" }),
    },
  );
  assert.equal(missingJobNote.response.status, 400);

  const approved = await request(
    `/api/lgu/verification/jobs/${created.body.job.id}/decision`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ decision: "approve", note: "Listing verified." }),
    },
  );
  assert.equal(approved.response.status, 200);
  assert.equal(approved.body.job.status, "active");
  assert.equal(approved.body.job.reviewStatus, "approved");

  const visible = await request(`/api/jobs/${created.body.job.id}`);
  assert.equal(visible.response.status, 200);
  assert.equal("reviewStatus" in visible.body.job, false);

  const rejectedEmployer = await request(
    `/api/lgu/employers/${employer.user.id}/decision`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        decision: "reject",
        note: "Employer evidence could not be verified.",
      }),
    },
  );
  assert.equal(rejectedEmployer.response.status, 200);
  assert.equal(rejectedEmployer.body.hiddenJobs, 1);
  const hiddenAfterRejection = await request(`/api/jobs/${created.body.job.id}`);
  assert.equal(hiddenAfterRejection.response.status, 404);

  const restoredEmployer = await request(
    `/api/lgu/employers/${employer.user.id}/decision`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ decision: "approve" }),
    },
  );
  assert.equal(restoredEmployer.response.status, 200);
  const stillHiddenAfterRestoration = await request(
    `/api/jobs/${created.body.job.id}`,
  );
  assert.equal(stillHiddenAfterRestoration.response.status, 404);

  const audit = await request("/api/lgu/audit-log", { headers });
  assert.equal(audit.response.status, 200);
  assert.deepEqual(
    new Set(audit.body.entries.map((entry) => entry.action)),
    new Set([
      "Requested employer evidence",
      "Verified employer",
      "Approved job post",
      "Rejected employer record",
    ]),
  );
  assert.equal(audit.body.total, audit.body.entries.length);
  assert.throws(
    () => db.prepare("UPDATE audit_events SET summary = 'changed' WHERE id = ?").run(
      audit.body.entries[0].id,
    ),
    /immutable/i,
  );
});

test("public jobs never expose a guest match score", async () => {
  const health = await request("/api/health");
  assert.equal(health.response.status, 200);
  assert.equal(
    health.response.headers.get("permissions-policy"),
    "geolocation=(self)",
  );

  const result = await request("/api/jobs");
  assert.equal(result.response.status, 200);
  assert.equal(result.body.jobs.length, 3);
  assert.equal("fit" in result.body.jobs[0], false);
  result.body.jobs.forEach((job) => assertDistanceOnlyRoute(job.route));
  const directJob = result.body.jobs.find(
    (job) => job.id === "it-support-assistant-lumina-tech",
  );
  assert.equal("ownerId" in directJob.source, false);
});

test("public jobs stay visible and can be sorted by nearest distance", async () => {
  const result = await request("/api/jobs?sort=nearest-distance");
  assert.equal(result.response.status, 200);
  assert.equal(result.body.jobs.length, 3);
  assert.deepEqual(
    result.body.jobs.map((job) => job.id),
    [
      "customer-service-associate-clarkconnect",
      "it-support-assistant-lumina-tech",
      "junior-web-developer-pixelnorth",
    ],
  );
  assert.deepEqual(
    result.body.jobs.map((job) => job.route.distanceKm),
    [3.1, 5.2, 7.8],
  );
});

test("route endpoint returns the Dijkstra path and never a stored fallback", async () => {
  db.prepare(`
    UPDATE geo_edges SET distance_km = 20
    WHERE from_node_id = 'balibago' AND to_node_id = 'marquee'
  `).run();

  const indirect = await request(
    "/api/jobs/junior-web-developer-pixelnorth/route",
  );
  assert.equal(indirect.response.status, 200);
  assert.equal(indirect.body.personalized, false);
  assertDijkstraLineString(indirect.body.route);
  assert.equal(indirect.body.route.distanceKm, 9.6);
  assert.deepEqual(indirect.body.route.geometry.coordinates, [
    [120.5874, 15.1667],
    [120.5882, 15.1458],
    [120.6098, 15.1571],
  ]);
  assert.equal(
    indirect.response.headers.get("cache-control"),
    "private, no-store",
  );
  assert.equal(indirect.response.headers.get("vary"), "Cookie");

  const listed = await request("/api/jobs?sort=nearest-distance");
  const listedJob = listed.body.jobs.find(
    (job) => job.id === "junior-web-developer-pixelnorth",
  );
  assert.equal(listedJob.route.distanceKm, 9.6);
  assertDijkstraLineString(listedJob.route);
  assert.equal("locationScore" in listedJob.route, false);

  db.prepare(`
    DELETE FROM geo_edges
    WHERE from_node_id = 'marquee' OR to_node_id = 'marquee'
  `).run();
  const unavailable = await request(
    "/api/jobs/junior-web-developer-pixelnorth/route",
  );
  assert.equal(unavailable.response.status, 422);
  assert.equal(unavailable.body.error.code, "ROUTE_UNAVAILABLE");
});

test("an incomplete seeker profile never receives personalized match data", async () => {
  const seeker = await register("job-seeker", "incomplete-match@example.com");
  const headers = { cookie: seeker.cookie };

  await request("/api/profile/skills", {
    method: "PUT",
    headers,
    body: JSON.stringify({ skills: ["Troubleshooting"] }),
  });

  const incompleteProfile = await request("/api/profile", { headers });
  assert.equal(incompleteProfile.body.profile.isComplete, false);

  const incompleteJobs = await request("/api/jobs", { headers });
  assert.equal("fit" in incompleteJobs.body.jobs[0], false);

  const incompleteDetail = await request(
    "/api/jobs/it-support-assistant-lumina-tech",
    { headers },
  );
  assert.equal("fit" in incompleteDetail.body.job, false);

  const incompleteRoute = await request(
    "/api/jobs/it-support-assistant-lumina-tech/route",
    { headers },
  );
  assert.equal(incompleteRoute.body.personalized, false);
  assertDistanceOnlyRoute(incompleteRoute.body.route);

  await request("/api/profile", {
    method: "PUT",
    headers,
    body: JSON.stringify({
      fullName: "Incomplete Seeker",
      mobileNumber: "09171234567",
      barangay: "Balibago",
      city: "Angeles City",
      homeNodeId: "balibago",
      preferredWorkTypes: [],
    }),
  });

  const completeProfile = await request("/api/profile", { headers });
  assert.equal(completeProfile.body.profile.isComplete, true);
  assert.equal("maximumDistanceKm" in completeProfile.body.profile, false);
  assert.equal("maximumMinutes" in completeProfile.body.profile, false);

  const completeJobs = await request("/api/jobs", { headers });
  assert.equal(completeJobs.body.jobs.length, 3);
  assert.equal(typeof completeJobs.body.jobs[0].fit.overallScore, "number");
  completeJobs.body.jobs.forEach((job) => assertDistanceOnlyRoute(job.route));
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
  assertDistanceOnlyRoute(result.body.job.fit.route);

  const route = await request(
    "/api/jobs/it-support-assistant-lumina-tech/route",
    { headers },
  );
  assert.equal(route.response.status, 200);
  assert.equal(route.body.personalized, true);
  assertDistanceOnlyRoute(route.body.route);
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

test("an employer can submit a job and review its application after approval", async () => {
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
      openingCount: 3,
      requiredSkills: ["Technical support", "API Test Unique Skill"],
      preferredSkills: ["Customer support", "API Test Preferred Skill"],
      salaryMinimumPhp: 19000,
      salaryMaximumPhp: 23000,
      closingAt: futureDeadline().slice(0, 10),
      status: "active",
    }),
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.job.openingCount, 3);
  assert.equal(created.body.job.status, "draft");
  assert.equal(created.body.job.reviewStatus, "pending");
  assert.ok(Date.parse(created.body.job.closingAt) > Date.now());
  const jobId = created.body.job.id;
  await approveJob(jobId);

  const searchableSkill = await request("/api/skills?query=API%20Test");
  assert.deepEqual(
    new Set(searchableSkill.body.skills.map((skill) => skill.name)),
    new Set(["API Test Preferred Skill", "API Test Unique Skill"]),
  );

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
      homeNodeId: "balibago",
      preferredWorkTypes: ["Full-time"],
    }),
  });
  await request("/api/profile/skills", {
    method: "PUT",
    headers: seekerHeaders,
    body: JSON.stringify({
      skills: ["Technical support", "API Test Unique Skill"],
    }),
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

test("company details persist on the server and rename owned jobs only", async () => {
  const employer = await register("employer", "company-owner@example.com");
  const otherEmployer = await register("employer", "other-company@example.com");
  const created = await request("/api/employer/jobs", {
    method: "POST",
    headers: { cookie: employer.cookie },
    body: JSON.stringify({
      title: "Company Identity Test",
      summary: "Verify company identity updates.",
      description: "This role checks company profile persistence.",
      employmentType: "Full-time",
      workArrangement: "Hybrid",
      geoNodeId: "balibago-business",
      openingCount: 2,
      requiredSkills: ["Company Identity Skill"],
      salaryMinimumPhp: 20000,
      salaryMaximumPhp: 24000,
      closingAt: futureDeadline(),
      status: "active",
    }),
  });
  assert.equal(created.response.status, 201);

  const saved = await request("/api/employer/company", {
    method: "PUT",
    headers: { cookie: employer.cookie },
    body: JSON.stringify({
      companyName: "Renamed Local Company",
      description: "A local employer profile.",
      website: "https://company.example",
      industry: "Information Technology",
      size: "11-50 employees",
      email: "careers@company.example",
      phone: "+63 917 000 0000",
      street: "123 Test Street",
      barangay: "Balibago",
      city: "Angeles City",
      province: "Pampanga",
      benefits: "Training\nHealth coverage",
    }),
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.body.company.companyName, "Renamed Local Company");
  assert.equal(saved.body.company.industry, "Information Technology");
  assert.equal(saved.body.company.email, "careers@company.example");
  assert.equal(saved.body.company.benefits, "Training\nHealth coverage");

  const reloaded = await request("/api/employer/company", {
    headers: { cookie: employer.cookie },
  });
  assert.deepEqual(reloaded.body.company, saved.body.company);

  const otherCompany = await request("/api/employer/company", {
    headers: { cookie: otherEmployer.cookie },
  });
  assert.notEqual(otherCompany.body.company.companyName, "Renamed Local Company");
  assert.equal(otherCompany.body.company.industry, undefined);

  await approveJob(created.body.job.id);
  const publicJob = await request(`/api/jobs/${created.body.job.id}`);
  assert.equal(publicJob.body.job.employerName, "Renamed Local Company");
  assert.equal(
    publicJob.body.job.source.organizationName,
    "Renamed Local Company",
  );

  const invalidWebsite = await request("/api/employer/company", {
    method: "PUT",
    headers: { cookie: employer.cookie },
    body: JSON.stringify({
      companyName: "Renamed Local Company",
      website: "javascript:alert(1)",
    }),
  });
  assert.equal(invalidWebsite.response.status, 400);
  assert.match(invalidWebsite.body.error.fields.website, /HTTP or HTTPS/);
});

test("employer posting rejects blank salaries and invalid contract values", async () => {
  const employer = await register("employer", "validation-owner@example.com");
  const input = {
    title: "Validated Job",
    summary: "Validate the employer job contract.",
    description: "A complete job description for validation.",
    employmentType: "Full-time",
    workArrangement: "On-site",
    geoNodeId: "balibago-business",
    openingCount: 1,
    requiredSkills: ["Validation Skill"],
    salaryMinimumPhp: "",
    salaryMaximumPhp: "25000",
    closingAt: futureDeadline(),
    status: "active",
  };

  const blankSalary = await request("/api/employer/jobs", {
    method: "POST",
    headers: { cookie: employer.cookie },
    body: JSON.stringify(input),
  });
  assert.equal(blankSalary.response.status, 400);
  assert.match(blankSalary.body.error.fields.salaryMinimumPhp, /minimum salary/i);

  const invalidType = await request("/api/employer/jobs", {
    method: "POST",
    headers: { cookie: employer.cookie },
    body: JSON.stringify({
      ...input,
      employmentType: "Permanent",
      salaryMinimumPhp: "20000",
    }),
  });
  assert.equal(invalidType.response.status, 400);
  assert.match(invalidType.body.error.fields.employmentType, /valid employment type/i);

  const invalidOpenings = await request("/api/employer/jobs", {
    method: "POST",
    headers: { cookie: employer.cookie },
    body: JSON.stringify({
      ...input,
      salaryMinimumPhp: "20000",
      openingCount: 0,
    }),
  });
  assert.equal(invalidOpenings.response.status, 400);
  assert.match(invalidOpenings.body.error.fields.openingCount, /1.*1,000/);
});

test("employers cannot access or mutate another employer's applicants", async () => {
  const owner = await register("employer", "secure-owner@example.com");
  const intruder = await register("employer", "other-owner@example.com");
  const created = await request("/api/employer/jobs", {
    method: "POST",
    headers: { cookie: owner.cookie },
    body: JSON.stringify({
      title: "Owned Role",
      summary: "Verify employer ownership boundaries.",
      description: "Only the owner may review this role's applicants.",
      employmentType: "Full-time",
      workArrangement: "On-site",
      geoNodeId: "nepo-center",
      requiredSkills: ["Ownership Test"],
      salaryMinimumPhp: 20000,
      salaryMaximumPhp: 24000,
      closingAt: futureDeadline(),
      status: "active",
    }),
  });
  const seeker = await register("job-seeker", "ownership-seeker@example.com");
  await approveJob(created.body.job.id);
  const submitted = await request("/api/applications", {
    method: "POST",
    headers: { cookie: seeker.cookie },
    body: applicationForm({
      jobId: created.body.job.id,
      fullName: "Ownership Seeker",
      email: "ownership-seeker@example.com",
      mobileNumber: "09170000003",
    }),
  });
  assert.equal(submitted.response.status, 201);

  const hiddenInbox = await request(
    `/api/employer/jobs/${created.body.job.id}/applications`,
    { headers: { cookie: intruder.cookie } },
  );
  assert.equal(hiddenInbox.response.status, 404);

  const hiddenJobMutation = await request(
    `/api/employer/jobs/${created.body.job.id}`,
    {
      method: "PATCH",
      headers: { cookie: intruder.cookie },
      body: JSON.stringify({ status: "closed" }),
    },
  );
  assert.equal(hiddenJobMutation.response.status, 404);

  const hiddenApplicationMutation = await request(
    `/api/employer/applications/${submitted.body.application.id}/status`,
    {
      method: "PATCH",
      headers: { cookie: intruder.cookie },
      body: JSON.stringify({ status: "Shortlisted" }),
    },
  );
  assert.equal(hiddenApplicationMutation.response.status, 404);

  const hiddenResume = await request(
    `/api/applications/${submitted.body.application.id}/resume`,
    { headers: { cookie: intruder.cookie } },
  );
  assert.equal(hiddenResume.response.status, 403);
  assert.equal(
    db
      .prepare("SELECT status FROM applications WHERE id = ?")
      .get(submitted.body.application.id).status,
    "Submitted",
  );
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

test("deadlines are validated and expired jobs stay unavailable everywhere", async () => {
  const employer = await register("employer", "expired-owner@example.com");
  const jobInput = {
    title: "Expiring Support Role",
    summary: "This listing is used to verify closing-date behavior.",
    description: "A test listing used to verify closing-date behavior.",
    employmentType: "Full-time",
    workArrangement: "On-site",
    geoNodeId: "nepo-center",
    requiredSkills: ["Technical support"],
    salaryMinimumPhp: 18000,
    salaryMaximumPhp: 22000,
    status: "active",
  };
  const rejected = await request("/api/employer/jobs", {
    method: "POST",
    headers: { cookie: employer.cookie },
    body: JSON.stringify({
      ...jobInput,
      closingAt: "2020-01-01T00:00:00.000Z",
    }),
  });
  assert.equal(rejected.response.status, 400);
  assert.match(rejected.body.error.fields.closingAt, /future/i);

  const invalidStatus = await request("/api/employer/jobs", {
    method: "POST",
    headers: { cookie: employer.cookie },
    body: JSON.stringify({
      ...jobInput,
      closingAt: futureDeadline(),
      status: "published",
    }),
  });
  assert.equal(invalidStatus.response.status, 400);
  assert.match(invalidStatus.body.error.fields.status, /draft or active/i);

  const draft = await request("/api/employer/jobs", {
    method: "POST",
    headers: { cookie: employer.cookie },
    body: JSON.stringify({ ...jobInput, status: "draft" }),
  });
  assert.equal(draft.response.status, 201);
  const missingActivationDeadline = await request(
    `/api/employer/jobs/${draft.body.job.id}`,
    {
      method: "PATCH",
      headers: { cookie: employer.cookie },
      body: JSON.stringify({ status: "active" }),
    },
  );
  assert.equal(missingActivationDeadline.response.status, 400);

  const activated = await request(`/api/employer/jobs/${draft.body.job.id}`, {
    method: "PATCH",
    headers: { cookie: employer.cookie },
    body: JSON.stringify({
      status: "active",
      closingAt: futureDeadline(),
    }),
  });
  assert.equal(activated.response.status, 200);
  assert.equal(activated.body.job.status, "draft");
  assert.equal(activated.body.job.reviewStatus, "pending");
  assert.ok(Date.parse(activated.body.job.closingAt) > Date.now());
  const approved = await approveJob(draft.body.job.id);
  assert.equal(approved.status, "active");
  assert.equal(approved.reviewStatus, "approved");
  await request(`/api/employer/jobs/${draft.body.job.id}`, {
    method: "PATCH",
    headers: { cookie: employer.cookie },
    body: JSON.stringify({ status: "closed" }),
  });

  const created = await request("/api/employer/jobs", {
    method: "POST",
    headers: { cookie: employer.cookie },
    body: JSON.stringify({ ...jobInput, closingAt: futureDeadline() }),
  });
  assert.equal(created.response.status, 201);
  const jobId = created.body.job.id;
  await approveJob(jobId);
  db.prepare("UPDATE jobs SET closing_at = ? WHERE id = ?").run(
    "2020-01-01T00:00:00.000Z",
    jobId,
  );

  const overview = await request("/api/employer/overview", {
    headers: { cookie: employer.cookie },
  });
  assert.equal(overview.body.metrics.activePosts, 0);

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
