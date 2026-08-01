import { Router } from "express";
import { isJobAvailable, rowToJob } from "../db.js";
import { sendError } from "../http.js";
import { getUserMatch } from "../matching.js";
import { calculateRoute } from "../routing.js";

function publicJob(job, fit) {
  const {
    ownerId: _ownerId,
    geoNodeId: _geoNodeId,
    status: _status,
    source,
    ...result
  } = job;
  const { ownerId: _sourceOwnerId, ...publicSource } = source ?? {};
  const publicResult = { ...result, source: publicSource };
  return fit ? { ...publicResult, fit, route: fit.route } : publicResult;
}

function matchForRequest(db, request, job) {
  if (request.user?.role !== "job-seeker") return null;
  return getUserMatch(db, request.user.id, job);
}

export function createPublicRouter(db) {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "jobfinder-api" });
  });

  router.get("/skills", (request, response) => {
    const query = String(request.query.query ?? "").trim();
    const rows = query
      ? db
          .prepare("SELECT id, name FROM skills WHERE name LIKE ? ORDER BY name LIMIT 20")
          .all(`%${query}%`)
      : db.prepare("SELECT id, name FROM skills ORDER BY name LIMIT 20").all();
    response.json({ skills: rows });
  });

  router.get("/data-sources", (_request, response) => {
    const sources = new Map();
    for (const job of db
      .prepare("SELECT * FROM jobs WHERE status = 'active'")
      .all()
      .map(rowToJob)
      .filter((job) => isJobAvailable(job))) {
      const source = job.source;
      const key = `${source.origin}:${source.organizationName}:${source.datasetName ?? ""}`;
      if (!sources.has(key)) {
        sources.set(key, {
          origin: source.origin,
          organizationName: source.organizationName,
          organizationType: source.organizationType,
          datasetName: source.datasetName,
          jurisdiction: source.jurisdiction,
          sourceUrl: source.sourceUrl,
          lastSyncedAt: source.lastSyncedAt,
          freshness: source.freshness,
        });
      }
    }
    response.json({ sources: [...sources.values()] });
  });

  router.get("/jobs", (request, response) => {
    const query = String(request.query.query ?? "").trim().toLowerCase();
    const employmentType = String(request.query.employmentType ?? "").trim();
    const workArrangement = String(request.query.workArrangement ?? "").trim();
    const sort = String(request.query.sort ?? "newest");
    const page = Math.max(Number.parseInt(String(request.query.page ?? "1"), 10) || 1, 1);
    const pageSize = Math.min(
      Math.max(Number.parseInt(String(request.query.pageSize ?? "20"), 10) || 20, 1),
      50,
    );

    let jobs = db
      .prepare("SELECT * FROM jobs WHERE status = 'active' ORDER BY posted_at DESC")
      .all()
      .map(rowToJob)
      .filter((job) => isJobAvailable(job))
      .filter((job) => {
        if (employmentType && job.employmentType !== employmentType) return false;
        if (workArrangement && job.workArrangement !== workArrangement) return false;
        if (!query) return true;
        const searchable = [
          job.title,
          job.employerName,
          job.summary,
          job.location.barangay,
          job.location.city,
          ...job.requirements.requiredSkills,
          ...job.requirements.preferredSkills,
          ...job.tags,
        ]
          .join(" ")
          .toLowerCase();
        return searchable.includes(query);
      })
      .map((job) => ({ job, fit: matchForRequest(db, request, job) }));

    if (sort === "best-match" && request.user?.role === "job-seeker") {
      jobs.sort((left, right) => (right.fit?.overallScore ?? -1) - (left.fit?.overallScore ?? -1));
    } else if (sort === "distance" || sort === "nearest-distance") {
      jobs.sort(
        (left, right) =>
          (left.fit?.route.distanceKm ?? left.job.route.distanceKm) -
          (right.fit?.route.distanceKm ?? right.job.route.distanceKm),
      );
    }

    const total = jobs.length;
    const start = (page - 1) * pageSize;
    response.json({
      jobs: jobs
        .slice(start, start + pageSize)
        .map(({ job, fit }) => publicJob(job, fit)),
      page,
      pageSize,
      total,
    });
  });

  router.get("/jobs/:jobId/route", (request, response) => {
    const job = rowToJob(
      db.prepare("SELECT * FROM jobs WHERE id = ?").get(request.params.jobId),
    );
    if (!isJobAvailable(job)) {
      sendError(response, 404, "JOB_NOT_FOUND", "This job is no longer available.");
      return;
    }

    const fit = matchForRequest(db, request, job);
    const route =
      fit?.route ??
      calculateRoute(db, "balibago", job.geoNodeId) ??
      job.route;
    const { locationScore: _locationScore, ...publicRoute } = route;
    response.json({
      route: fit ? route : publicRoute,
      personalized: Boolean(fit),
      startingArea: fit ? "Saved Home Area" : "Balibago Reference Area",
    });
  });

  router.get("/jobs/:jobId", (request, response) => {
    const job = rowToJob(
      db.prepare("SELECT * FROM jobs WHERE id = ?").get(request.params.jobId),
    );
    if (!isJobAvailable(job)) {
      sendError(response, 404, "JOB_NOT_FOUND", "This job is no longer available.");
      return;
    }
    response.json({ job: publicJob(job, matchForRequest(db, request, job)) });
  });

  return router;
}
