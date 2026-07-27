import type {
  EmploymentType,
  JobListing,
  WorkArrangement,
} from "./types";

export const EMPLOYER_PUBLISHED_POSTS_STORAGE_KEY =
  "jobfinder.employer.published-posts.v1";

export type PublishedEmployerPost = {
  barangay: string;
  city: string;
  deadline: string;
  description: string;
  employmentType: string;
  employerName: string;
  id: string;
  location: string;
  openings: string;
  ownerId: string;
  province: string;
  publishedAt: string;
  salaryMax: string;
  salaryMin: string;
  schedule: string;
  skills: string[];
  title: string;
  workSetup: string;
};

const employmentTypes: EmploymentType[] = [
  "Full-time",
  "Part-time",
  "Contract",
  "Temporary",
  "Internship",
];
const workArrangements: WorkArrangement[] = ["On-site", "Hybrid", "Remote"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStoredEmployerPost(
  value: unknown,
): value is PublishedEmployerPost {
  if (!isRecord(value)) return false;

  const stringFields = [
    "barangay",
    "city",
    "deadline",
    "description",
    "employmentType",
    "employerName",
    "id",
    "location",
    "openings",
    "ownerId",
    "province",
    "publishedAt",
    "salaryMax",
    "salaryMin",
    "schedule",
    "title",
    "workSetup",
  ];

  return (
    stringFields.every((field) => typeof value[field] === "string") &&
    Array.isArray(value.skills) &&
    value.skills.every(
      (skill) => typeof skill === "string" && skill.trim().length > 0,
    ) &&
    Number.isFinite(Date.parse(value.publishedAt as string))
  );
}

function normalizeEmploymentType(value: string): EmploymentType {
  return employmentTypes.includes(value as EmploymentType)
    ? (value as EmploymentType)
    : "Full-time";
}

function normalizeWorkArrangement(value: string): WorkArrangement {
  return workArrangements.includes(value as WorkArrangement)
    ? (value as WorkArrangement)
    : "On-site";
}

function toPositiveNumber(value: string, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function toSkillId(skill: string): string {
  return `skill-${skill
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

function toJobListing(
  post: PublishedEmployerPost,
  employerName: string,
): JobListing {
  const publishedAt = new Date(post.publishedAt);
  const savedDeadline = new Date(`${post.deadline}T17:00:00+08:00`);
  const closingAt = Number.isFinite(savedDeadline.getTime())
    ? savedDeadline
    : new Date(publishedAt);
  if (!Number.isFinite(savedDeadline.getTime())) {
    closingAt.setDate(closingAt.getDate() + 30);
  }
  const requiredSkills = post.skills.slice(0, 8);

  return {
    id: post.id,
    title: post.title,
    employerName,
    summary: post.description,
    description: post.description,
    location: {
      venue: `${employerName}, ${post.barangay}`,
      barangay: post.barangay,
      city: "Angeles City",
      province: "Pampanga",
    },
    employmentType: normalizeEmploymentType(post.employmentType),
    workArrangement: normalizeWorkArrangement(post.workSetup),
    schedule: post.schedule,
    salary: {
      minimumPhp: toPositiveNumber(post.salaryMin, 0),
      maximumPhp: toPositiveNumber(post.salaryMax, 0),
      period: "month",
    },
    postedAt: post.publishedAt,
    closingAt: closingAt.toISOString(),
    requirements: {
      requiredSkills,
      preferredSkills: [],
      education: "Confirm education requirements with the employer.",
      experience: "Review the role description and demonstrate relevant experience.",
      responsibilities: [post.description],
      additionalRequirements: [
        `${toPositiveNumber(post.openings, 1)} opening(s) available`,
        `Work schedule: ${post.schedule}`,
      ],
    },
    fit: {
      overallScore: 82,
      skillScore: 84,
      locationScore: 78,
      weights: { skill: 0.7, location: 0.3 },
      exactSkills: requiredSkills.slice(0, 2).map((skill) => ({
        skillId: toSkillId(skill),
        label: skill,
        kind: "exact",
        credit: 1,
        evidenceSource: "profile",
      })),
      relatedSkills: requiredSkills.slice(2, 3).map((skill) => ({
        skillId: toSkillId(skill),
        label: skill,
        kind: "related",
        credit: 0.7,
        ontologyPath: ["Related competency", skill],
        evidenceSource: "self-reported",
      })),
      missingSkills: requiredSkills.slice(3).map((skill) => ({
        skillId: toSkillId(skill),
        label: skill,
        kind: "missing",
        credit: 0,
      })),
      summary:
        "This prototype preview uses the saved profile evidence. The matching API will provide the final ontology and location scores.",
    },
    route: {
      routeId: `route-${post.id}`,
      mode: "public-transport",
      distanceKm: 5.5,
      estimatedMinutes: 22,
      estimatedFarePhp: 28,
      steps: [
        {
          order: 1,
          instruction: `Travel from your saved home area toward ${post.barangay}.`,
          distanceKm: 5,
          estimatedMinutes: 17,
        },
        {
          order: 2,
          instruction: `Continue to the employer's workplace in ${post.barangay}.`,
          distanceKm: 0.5,
          estimatedMinutes: 5,
        },
      ],
      textSummary: `Estimated 5.5 km and 22 minutes from the saved home area to ${post.barangay}, Angeles City. Confirm the route before travelling.`,
      accessibilityStatus: "within-limit",
      isEstimate: true,
    },
    source: {
      origin: "direct-employer",
      organizationName: employerName,
      organizationType: "employer",
      ownerId: post.ownerId,
      freshness: "current",
      publishedAt: post.publishedAt,
      lastSyncedAt: post.publishedAt,
      applicationMethod: "jobfinder",
      applicationInstructions:
        "Sign in to complete the employer's JobFinder application form.",
    },
    tags: [
      normalizeEmploymentType(post.employmentType),
      normalizeWorkArrangement(post.workSetup),
      "Direct employer post",
      "Angeles City",
    ],
  };
}

export function readPublishedEmployerPosts(
  ownerId?: string,
): PublishedEmployerPost[] {
  if (typeof window === "undefined") return [];

  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(EMPLOYER_PUBLISHED_POSTS_STORAGE_KEY) ?? "[]",
    );
    if (!Array.isArray(value)) return [];

    const posts = value.filter(isStoredEmployerPost);
    return ownerId
      ? posts.filter((post) => post.ownerId === ownerId)
      : posts;
  } catch {
    return [];
  }
}

export function savePublishedEmployerPost(
  post: PublishedEmployerPost,
  draftStorageKey: string,
): boolean {
  if (typeof window === "undefined") return false;

  try {
    const existing = readPublishedEmployerPosts().filter(
      (savedPost) => savedPost.id !== post.id,
    );
    window.localStorage.setItem(
      EMPLOYER_PUBLISHED_POSTS_STORAGE_KEY,
      JSON.stringify([post, ...existing]),
    );
    window.localStorage.removeItem(draftStorageKey);
    return true;
  } catch {
    return false;
  }
}

export function getPublishedEmployerJobListings(): JobListing[] {
  return readPublishedEmployerPosts()
    .filter(
      (post) =>
        post.city.trim().toLowerCase() === "angeles city" &&
        post.province.trim().toLowerCase() === "pampanga",
    )
    .map((post) => toJobListing(post, post.employerName));
}
