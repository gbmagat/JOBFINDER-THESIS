import { createHash } from "node:crypto";

const APPLICATION_METHODS = new Set([
  "email",
  "external-url",
  "phone",
  "in-person",
]);
const SOURCE_TYPES = new Set(["peso", "lgu"]);
const EMPLOYMENT_TYPES = new Set([
  "Full-time",
  "Part-time",
  "Contract",
  "Temporary",
  "Internship",
]);
const WORK_ARRANGEMENTS = new Set(["On-site", "Hybrid", "Remote"]);
const SALARY_PERIODS = new Set(["hour", "day", "month", "year"]);
const ROUTE_MODES = new Set([
  "walk",
  "motorcycle",
  "drive",
  "public-transport",
]);
const ACCESSIBILITY_STATUSES = new Set([
  "within-limit",
  "near-limit",
  "over-limit",
]);

function object(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value;
}

function text(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function number(value, field, minimum = 0) {
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(`${field} must be a number of at least ${minimum}`);
  }
  return value;
}

function date(value, field) {
  const result = text(value, field);
  if (!Number.isFinite(Date.parse(result))) {
    throw new Error(`${field} must be a valid date`);
  }
  return result;
}

function texts(value, field, minimumItems = 0) {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  const result = [];
  const seen = new Set();
  value.forEach((item, index) => {
    const normalized = text(item, `${field}[${index}]`)
      .normalize("NFKC")
      .replace(/\s+/g, " ");
    const key = normalized.toLocaleLowerCase("en");
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });
  if (result.length < minimumItems) {
    throw new Error(`${field} must contain at least ${minimumItems} item`);
  }
  return result;
}

function webUrl(value, field) {
  const result = text(value, field);
  try {
    const url = new URL(result);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    throw new Error(`${field} must be an HTTP or HTTPS URL`);
  }
  return result;
}

function applicationTarget(value, method) {
  const target = text(value, "source.applicationTarget");
  if (method === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
    throw new Error("source.applicationTarget must be a valid email address");
  }
  if (method === "external-url") {
    webUrl(target, "source.applicationTarget");
  }
  return target;
}

function stablePart(value) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function datasetJobId(organizationName, externalRecordId) {
  const identity = `${stablePart(organizationName)}\u0000${stablePart(externalRecordId)}`;
  const digest = createHash("sha256").update(identity).digest("hex").slice(0, 24);
  return `dataset-${digest}`;
}

export function validateAndNormalizeDatasetJob(value) {
  const job = object(value, "job");
  const location = object(job.location, "location");
  const salary = object(job.salary, "salary");
  const requirements = object(job.requirements, "requirements");
  const route = object(job.route, "route");
  const source = object(job.source, "source");

  const organizationName = text(source.organizationName, "source.organizationName");
  const externalRecordId = text(source.externalRecordId, "source.externalRecordId");
  const applicationMethod = text(source.applicationMethod, "source.applicationMethod");
  if (source.origin !== "peso-lgu-dataset") {
    throw new Error("source.origin must be peso-lgu-dataset");
  }
  if (!SOURCE_TYPES.has(source.organizationType)) {
    throw new Error("source.organizationType must be peso or lgu");
  }
  if (!APPLICATION_METHODS.has(applicationMethod)) {
    throw new Error(
      "source.applicationMethod must be email, external-url, phone, or in-person",
    );
  }

  const postedAt = date(job.postedAt, "postedAt");
  const closingAt = job.closingAt ? date(job.closingAt, "closingAt") : undefined;
  if (closingAt && Date.parse(closingAt) <= Date.parse(postedAt)) {
    throw new Error("closingAt must be later than postedAt");
  }

  const minimumPhp = number(salary.minimumPhp, "salary.minimumPhp");
  const maximumPhp = number(salary.maximumPhp, "salary.maximumPhp");
  if (maximumPhp < minimumPhp) {
    throw new Error("salary.maximumPhp must not be lower than salary.minimumPhp");
  }
  if (typeof salary.negotiable !== "boolean") {
    throw new Error("salary.negotiable must be true or false");
  }
  const salaryPeriod = text(salary.period, "salary.period");
  if (!SALARY_PERIODS.has(salaryPeriod)) {
    throw new Error("salary.period must be hour, day, month, or year");
  }

  const employmentType = text(job.employmentType, "employmentType");
  if (!EMPLOYMENT_TYPES.has(employmentType)) {
    throw new Error("employmentType is invalid");
  }
  const workArrangement = text(job.workArrangement, "workArrangement");
  if (!WORK_ARRANGEMENTS.has(workArrangement)) {
    throw new Error("workArrangement is invalid");
  }
  const openingCount =
    job.openingCount === undefined
      ? 1
      : number(job.openingCount, "openingCount", 1);
  if (!Number.isInteger(openingCount)) {
    throw new Error("openingCount must be a whole number");
  }

  const latitude = number(location.latitude, "location.latitude", -90);
  const longitude = number(location.longitude, "location.longitude", -180);
  if (latitude > 90) throw new Error("location.latitude must be at most 90");
  if (longitude > 180) throw new Error("location.longitude must be at most 180");

  const accessibilityStatus = text(
    route.accessibilityStatus,
    "route.accessibilityStatus",
  );
  if (!ACCESSIBILITY_STATUSES.has(accessibilityStatus)) {
    throw new Error("route.accessibilityStatus is invalid");
  }
  if (typeof route.isEstimate !== "boolean") {
    throw new Error("route.isEstimate must be true or false");
  }
  const routeMode = text(route.mode, "route.mode");
  if (!ROUTE_MODES.has(routeMode)) {
    throw new Error("route.mode is invalid");
  }
  if (!Array.isArray(route.steps) || route.steps.length === 0) {
    throw new Error("route.steps must contain at least 1 item");
  }
  const steps = route.steps.map((value, index) => {
    const step = object(value, `route.steps[${index}]`);
    return {
      ...step,
      order: number(step.order, `route.steps[${index}].order`, 1),
      instruction: text(step.instruction, `route.steps[${index}].instruction`),
      distanceKm: number(step.distanceKm, `route.steps[${index}].distanceKm`),
      estimatedMinutes: number(
        step.estimatedMinutes,
        `route.steps[${index}].estimatedMinutes`,
      ),
    };
  });

  return {
    ...job,
    id: datasetJobId(organizationName, externalRecordId),
    geoNodeId: text(job.geoNodeId, "geoNodeId"),
    title: text(job.title, "title"),
    employerName: text(job.employerName, "employerName"),
    summary: text(job.summary, "summary"),
    description: text(job.description, "description"),
    employmentType,
    workArrangement,
    openingCount,
    schedule: text(job.schedule, "schedule"),
    postedAt,
    ...(closingAt ? { closingAt } : {}),
    location: {
      ...location,
      venue: text(location.venue, "location.venue"),
      barangay: text(location.barangay, "location.barangay"),
      city: text(location.city, "location.city"),
      province: text(location.province, "location.province"),
      latitude,
      longitude,
    },
    salary: {
      ...salary,
      minimumPhp,
      maximumPhp,
      period: salaryPeriod,
      negotiable: salary.negotiable,
    },
    requirements: {
      ...requirements,
      requiredSkills: texts(
        requirements.requiredSkills,
        "requirements.requiredSkills",
        1,
      ),
      preferredSkills: texts(
        requirements.preferredSkills,
        "requirements.preferredSkills",
      ),
      education: text(requirements.education, "requirements.education"),
      experience: text(requirements.experience, "requirements.experience"),
      responsibilities: texts(
        requirements.responsibilities,
        "requirements.responsibilities",
        1,
      ),
      additionalRequirements: texts(
        requirements.additionalRequirements,
        "requirements.additionalRequirements",
      ),
    },
    route: {
      ...route,
      routeId: text(route.routeId, "route.routeId"),
      mode: routeMode,
      distanceKm: number(route.distanceKm, "route.distanceKm"),
      estimatedMinutes: number(route.estimatedMinutes, "route.estimatedMinutes"),
      ...(route.estimatedFarePhp === undefined
        ? {}
        : {
            estimatedFarePhp: number(
              route.estimatedFarePhp,
              "route.estimatedFarePhp",
            ),
          }),
      steps,
      textSummary: text(route.textSummary, "route.textSummary"),
      accessibilityStatus,
      isEstimate: route.isEstimate,
    },
    source: {
      ...source,
      origin: "peso-lgu-dataset",
      organizationName,
      organizationType: source.organizationType,
      datasetName: text(source.datasetName, "source.datasetName"),
      jurisdiction: text(source.jurisdiction, "source.jurisdiction"),
      externalRecordId,
      sourceUrl: webUrl(source.sourceUrl, "source.sourceUrl"),
      freshness: text(source.freshness, "source.freshness"),
      publishedAt: date(source.publishedAt, "source.publishedAt"),
      lastSyncedAt: date(source.lastSyncedAt, "source.lastSyncedAt"),
      applicationMethod,
      applicationTarget: applicationTarget(source.applicationTarget, applicationMethod),
      applicationInstructions: text(
        source.applicationInstructions,
        "source.applicationInstructions",
      ),
    },
    tags: texts(job.tags, "tags"),
  };
}
