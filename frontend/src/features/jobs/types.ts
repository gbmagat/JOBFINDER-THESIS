export type JobOrigin = "direct-employer" | "peso-lgu-dataset";

export type JobFreshness = "current" | "stale" | "unknown";

export type ApplicationMethod =
  | "jobfinder"
  | "external-url"
  | "email"
  | "phone"
  | "in-person";

export type EmploymentType =
  | "Full-time"
  | "Part-time"
  | "Contract"
  | "Temporary"
  | "Internship";

export type WorkArrangement = "On-site" | "Hybrid" | "Remote";

export type TravelMode =
  | "walk"
  | "motorcycle"
  | "drive"
  | "public-transport";

export type SkillEvidenceKind = "exact" | "related" | "missing";

export type EvidenceSource = "profile" | "resume" | "self-reported";

export interface SkillEvidence {
  skillId: string;
  label: string;
  kind: SkillEvidenceKind;
  credit: number;
  ontologyPath?: string[];
  evidenceSource?: EvidenceSource;
}

export interface MatchExplanation {
  overallScore: number;
  skillScore: number;
  locationScore: number;
  weights: {
    skill: 0.7;
    location: 0.3;
  };
  exactSkills: SkillEvidence[];
  relatedSkills: SkillEvidence[];
  missingSkills: SkillEvidence[];
  summary: string;
}

export interface GeoJsonLineString {
  type: "LineString";
  coordinates: [longitude: number, latitude: number][];
}

export interface RouteStep {
  order: number;
  instruction: string;
  distanceKm?: number;
}

export interface RouteOption {
  routeId: string;
  mode: TravelMode;
  geometry?: GeoJsonLineString;
  distanceKm: number;
  estimatedFarePhp?: number;
  steps: RouteStep[];
  textSummary: string;
  isEstimate: boolean;
}

export interface SalaryRange {
  minimumPhp: number;
  maximumPhp: number;
  period: "hour" | "day" | "month" | "year";
  negotiable?: boolean;
}

export interface JobLocation {
  venue: string;
  barangay: string;
  city: "Angeles City";
  province: "Pampanga";
  latitude?: number;
  longitude?: number;
}

export interface JobRequirements {
  requiredSkills: string[];
  preferredSkills: string[];
  education: string;
  experience: string;
  responsibilities: string[];
  additionalRequirements?: string[];
}

export interface AlternateApplicationMethod {
  method: Exclude<ApplicationMethod, "jobfinder">;
  target: string;
  instructions: string;
}

interface JobSourceBase {
  organizationName: string;
  freshness: JobFreshness;
  publishedAt?: string;
  lastSyncedAt?: string;
  sourceUrl?: string;
  applicationMethod: ApplicationMethod;
  applicationTarget?: string;
  applicationInstructions?: string;
  alternateApplicationMethods?: AlternateApplicationMethod[];
}

export interface DirectEmployerJobSource extends JobSourceBase {
  origin: "direct-employer";
  organizationType: "employer";
  ownerId?: string;
}

export interface PesoLguDatasetJobSource extends JobSourceBase {
  origin: "peso-lgu-dataset";
  organizationType: "peso" | "lgu";
  datasetName: string;
  jurisdiction: string;
  externalRecordId: string;
  lastSyncedAt: string;
  applicationMethod: Exclude<ApplicationMethod, "jobfinder">;
}

export type JobSource = DirectEmployerJobSource | PesoLguDatasetJobSource;

export interface JobListing {
  id: string;
  title: string;
  employerName: string;
  summary: string;
  description: string;
  location: JobLocation;
  employmentType: EmploymentType;
  workArrangement: WorkArrangement;
  schedule?: string;
  openingCount?: number;
  salary: SalaryRange;
  postedAt: string;
  closingAt?: string;
  requirements: JobRequirements;
  fit: MatchExplanation;
  route: RouteOption;
  source: JobSource;
  tags: string[];
}
