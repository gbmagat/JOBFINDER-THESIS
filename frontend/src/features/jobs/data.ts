import type {
  ApplicationMethod,
  JobListing,
  JobSource,
} from "./types";
import { getPublishedEmployerJobListings } from "./employer-posts";

export const JOBS: JobListing[] = [
  {
    id: "it-support-assistant-lumina-tech",
    title: "IT Support Assistant",
    employerName: "Lumina Tech Solutions",
    summary:
      "Support employee workstations, resolve everyday technical issues, and help maintain reliable office connectivity.",
    description:
      "Lumina Tech Solutions is looking for an entry-level IT support professional who can explain technical steps clearly and keep accurate service records. The role combines desk-side support, basic network troubleshooting, and coordination with senior technicians.",
    location: {
      venue: "Lumina Tech Solutions, Nepo Center",
      barangay: "Sto. Rosario",
      city: "Angeles City",
      province: "Pampanga",
      latitude: 15.1458,
      longitude: 120.5882,
    },
    employmentType: "Full-time",
    workArrangement: "On-site",
    schedule: "Day shift",
    salary: {
      minimumPhp: 19_000,
      maximumPhp: 24_000,
      period: "month",
    },
    postedAt: "2026-07-21T08:30:00+08:00",
    closingAt: "2026-08-15T17:00:00+08:00",
    requirements: {
      requiredSkills: [
        "Computer troubleshooting",
        "Customer support",
        "Basic networking",
        "Technical documentation",
      ],
      preferredSkills: ["Windows administration", "Basic scripting"],
      education:
        "Senior high school graduate, technical-vocational certificate, or college coursework in IT or a related field",
      experience:
        "Entry-level applicants are welcome; school, volunteer, or internship support experience is useful",
      responsibilities: [
        "Diagnose common workstation, printer, and connectivity issues",
        "Document incidents and solutions in the support log",
        "Set up user devices and approved applications",
        "Escalate security or infrastructure issues to senior technicians",
      ],
      additionalRequirements: [
        "Able to work on site in Angeles City",
        "Clear written and verbal communication",
      ],
    },
    fit: {
      overallScore: 91,
      skillScore: 95,
      locationScore: 82,
      weights: { skill: 0.7, location: 0.3 },
      exactSkills: [
        {
          skillId: "skill-troubleshooting",
          label: "Computer troubleshooting",
          kind: "exact",
          credit: 1,
          evidenceSource: "profile",
        },
        {
          skillId: "skill-customer-support",
          label: "Customer support",
          kind: "exact",
          credit: 1,
          evidenceSource: "resume",
        },
        {
          skillId: "skill-basic-networking",
          label: "Basic networking",
          kind: "exact",
          credit: 1,
          evidenceSource: "self-reported",
        },
      ],
      relatedSkills: [
        {
          skillId: "skill-programming",
          label: "Basic scripting",
          kind: "related",
          credit: 0.7,
          ontologyPath: ["Java", "Programming", "Basic scripting"],
          evidenceSource: "profile",
        },
      ],
      missingSkills: [
        {
          skillId: "skill-windows-admin",
          label: "Windows administration",
          kind: "missing",
          credit: 0,
        },
      ],
      summary:
        "Your troubleshooting, customer support, and networking skills closely match this role. Basic scripting receives related-skill credit.",
    },
    route: {
      routeId: "route-balibago-nepo-public-transport",
      mode: "public-transport",
      distanceKm: 5.2,
      estimatedMinutes: 18,
      estimatedFarePhp: 26,
      steps: [
        {
          order: 1,
          instruction: "Walk to the Balibago transport stop.",
          distanceKm: 0.3,
          estimatedMinutes: 4,
        },
        {
          order: 2,
          instruction:
            "Take a local public-transport service toward Sto. Rosario or Nepo Center.",
          distanceKm: 4.6,
          estimatedMinutes: 11,
        },
        {
          order: 3,
          instruction: "Walk from the drop-off point to Nepo Center.",
          distanceKm: 0.3,
          estimatedMinutes: 3,
        },
      ],
      textSummary:
        "Estimated 5.2 km and 18 minutes from Balibago using local public transport, including short walks at both ends.",
      accessibilityStatus: "within-limit",
      isEstimate: true,
    },
    source: {
      origin: "direct-employer",
      organizationName: "Lumina Tech Solutions",
      organizationType: "employer",
      ownerId: "mock-employer@luminatech.example",
      freshness: "current",
      publishedAt: "2026-07-21T08:30:00+08:00",
      lastSyncedAt: "2026-07-26T08:00:00+08:00",
      applicationMethod: "jobfinder",
      applicationInstructions:
        "Sign in to complete the employer's JobFinder application form.",
    },
    tags: ["Entry level", "IT support", "On-site", "Angeles City"],
  },
  {
    id: "customer-service-associate-clarkconnect",
    title: "Customer Service Associate",
    employerName: "ClarkConnect Services",
    summary:
      "Assist customers through phone and chat, document concerns, and coordinate timely resolutions with service teams.",
    description:
      "This vacancy was supplied through an Angeles City PESO dataset. The work focuses on customer communication, accurate case notes, and first-contact resolution in a team-based service environment.",
    location: {
      venue: "ClarkConnect Services, Balibago Business Center",
      barangay: "Balibago",
      city: "Angeles City",
      province: "Pampanga",
      latitude: 15.1667,
      longitude: 120.5874,
    },
    employmentType: "Full-time",
    workArrangement: "On-site",
    schedule: "Rotating shifts",
    salary: {
      minimumPhp: 20_000,
      maximumPhp: 27_000,
      period: "month",
    },
    postedAt: "2026-07-18T09:00:00+08:00",
    closingAt: "2026-08-08T17:00:00+08:00",
    requirements: {
      requiredSkills: [
        "Customer service",
        "Spoken English",
        "Active listening",
        "Case documentation",
      ],
      preferredSkills: ["Chat support", "Conflict resolution"],
      education:
        "At least senior high school graduate or an equivalent qualification",
      experience:
        "Customer-facing school, volunteer, retail, hospitality, or contact-center experience is useful but not required",
      responsibilities: [
        "Respond to customer questions through phone and chat",
        "Record concerns and actions accurately",
        "Follow service procedures and escalation paths",
        "Coordinate with internal teams on unresolved cases",
      ],
      additionalRequirements: [
        "Willing to work rotating schedules",
        "Applicants should confirm documentary requirements with Angeles City PESO",
      ],
    },
    fit: {
      overallScore: 87,
      skillScore: 90,
      locationScore: 80,
      weights: { skill: 0.7, location: 0.3 },
      exactSkills: [
        {
          skillId: "skill-customer-service",
          label: "Customer service",
          kind: "exact",
          credit: 1,
          evidenceSource: "resume",
        },
        {
          skillId: "skill-spoken-english",
          label: "Spoken English",
          kind: "exact",
          credit: 1,
          evidenceSource: "profile",
        },
        {
          skillId: "skill-active-listening",
          label: "Active listening",
          kind: "exact",
          credit: 1,
          evidenceSource: "self-reported",
        },
      ],
      relatedSkills: [
        {
          skillId: "skill-written-communication",
          label: "Chat support",
          kind: "related",
          credit: 0.65,
          ontologyPath: [
            "Written communication",
            "Digital customer communication",
            "Chat support",
          ],
          evidenceSource: "profile",
        },
      ],
      missingSkills: [
        {
          skillId: "skill-case-documentation",
          label: "Case documentation",
          kind: "missing",
          credit: 0,
        },
      ],
      summary:
        "Your customer-service and communication skills are a strong match. Case documentation is a skill to demonstrate or develop.",
    },
    route: {
      routeId: "route-balibago-walk",
      mode: "walk",
      distanceKm: 3.1,
      estimatedMinutes: 38,
      steps: [
        {
          order: 1,
          instruction: "Follow the main pedestrian route toward Balibago.",
          distanceKm: 2.6,
          estimatedMinutes: 31,
        },
        {
          order: 2,
          instruction: "Continue to Balibago Business Center.",
          distanceKm: 0.5,
          estimatedMinutes: 7,
        },
      ],
      textSummary:
        "Estimated 3.1 km and 38 minutes on foot to Balibago Business Center. Local conditions may change the route.",
      accessibilityStatus: "near-limit",
      isEstimate: true,
    },
    source: {
      origin: "peso-lgu-dataset",
      organizationName: "Angeles City Public Employment Service Office",
      organizationType: "peso",
      datasetName: "Angeles City PESO Employment Opportunities",
      jurisdiction: "Angeles City, Pampanga",
      externalRecordId: "ACPESO-2026-0718-044",
      sourceUrl: "https://www.angelescity.gov.ph/",
      freshness: "current",
      publishedAt: "2026-07-18T09:00:00+08:00",
      lastSyncedAt: "2026-07-25T16:10:00+08:00",
      applicationMethod: "email",
      applicationTarget: "applications@clarkconnect.example",
      applicationInstructions:
        "After signing in, follow the source record's instructions to email your resume and include record ACPESO-2026-0718-044 in the subject.",
      alternateApplicationMethods: [
        {
          method: "in-person",
          target: "Angeles City PESO office",
          instructions:
            "Bring a resume and valid identification, and ask for record ACPESO-2026-0718-044.",
        },
      ],
    },
    tags: ["Customer service", "PESO dataset", "On-site", "Angeles City"],
  },
  {
    id: "junior-web-developer-pixelnorth",
    title: "Junior Web Developer",
    employerName: "PixelNorth Digital Studio",
    summary:
      "Build and maintain responsive client websites with a small product team using modern HTML, CSS, and JavaScript.",
    description:
      "PixelNorth Digital Studio is seeking a junior developer who enjoys turning interface designs into accessible, responsive pages. Applications continue on the employer's external careers website after JobFinder sign-in.",
    location: {
      venue: "PixelNorth Digital Studio, Marquee Business Park",
      barangay: "Pulung Maragul",
      city: "Angeles City",
      province: "Pampanga",
      latitude: 15.1571,
      longitude: 120.6098,
    },
    employmentType: "Full-time",
    workArrangement: "Hybrid",
    schedule: "Flexible day shift",
    salary: {
      minimumPhp: 24_000,
      maximumPhp: 32_000,
      period: "month",
      negotiable: true,
    },
    postedAt: "2026-07-23T10:15:00+08:00",
    closingAt: "2026-08-20T17:00:00+08:00",
    requirements: {
      requiredSkills: [
        "HTML",
        "CSS",
        "JavaScript",
        "Responsive web design",
      ],
      preferredSkills: ["React", "Git", "Web accessibility"],
      education:
        "Portfolio, technical-vocational training, or college coursework demonstrating web-development fundamentals",
      experience:
        "Entry-level applicants are welcome; personal, school, freelance, or internship projects may be presented",
      responsibilities: [
        "Translate approved designs into responsive web pages",
        "Fix interface bugs across current browsers",
        "Participate in code review and team planning",
        "Document reusable components and implementation decisions",
      ],
      additionalRequirements: [
        "Portfolio or links to sample work",
        "Available for scheduled on-site collaboration days",
      ],
    },
    fit: {
      overallScore: 84,
      skillScore: 88,
      locationScore: 75,
      weights: { skill: 0.7, location: 0.3 },
      exactSkills: [
        {
          skillId: "skill-html",
          label: "HTML",
          kind: "exact",
          credit: 1,
          evidenceSource: "profile",
        },
        {
          skillId: "skill-css",
          label: "CSS",
          kind: "exact",
          credit: 1,
          evidenceSource: "profile",
        },
        {
          skillId: "skill-javascript",
          label: "JavaScript",
          kind: "exact",
          credit: 1,
          evidenceSource: "resume",
        },
      ],
      relatedSkills: [
        {
          skillId: "skill-react",
          label: "React",
          kind: "related",
          credit: 0.75,
          ontologyPath: [
            "JavaScript",
            "Front-end development",
            "React",
          ],
          evidenceSource: "self-reported",
        },
      ],
      missingSkills: [
        {
          skillId: "skill-web-accessibility",
          label: "Web accessibility",
          kind: "missing",
          credit: 0,
        },
      ],
      summary:
        "Your core front-end skills align well. React receives related-skill credit, while accessibility practice is a development area.",
    },
    route: {
      routeId: "route-balibago-marquee-public-transport",
      mode: "public-transport",
      distanceKm: 7.8,
      estimatedMinutes: 27,
      estimatedFarePhp: 32,
      steps: [
        {
          order: 1,
          instruction: "Walk to a transport stop serving Marquee.",
          distanceKm: 0.4,
          estimatedMinutes: 5,
        },
        {
          order: 2,
          instruction:
            "Take local public transport toward Marquee or Pulung Maragul.",
          distanceKm: 6.9,
          estimatedMinutes: 17,
        },
        {
          order: 3,
          instruction: "Walk to Marquee Business Park.",
          distanceKm: 0.5,
          estimatedMinutes: 5,
        },
      ],
      textSummary:
        "Estimated 7.8 km and 27 minutes from Balibago using local public transport and short walking connections.",
      accessibilityStatus: "near-limit",
      isEstimate: true,
    },
    source: {
      origin: "direct-employer",
      organizationName: "PixelNorth Digital Studio",
      organizationType: "employer",
      ownerId: "mock-employer@pixelnorth.example",
      freshness: "current",
      publishedAt: "2026-07-23T10:15:00+08:00",
      lastSyncedAt: "2026-07-26T08:00:00+08:00",
      sourceUrl: "https://careers.example.org/",
      applicationMethod: "external-url",
      applicationTarget:
        "https://careers.example.org/jobs/junior-web-developer",
      applicationInstructions:
        "After signing in, JobFinder will show a clear handoff before opening the employer's careers website.",
    },
    tags: ["Web development", "Hybrid", "External application", "Angeles City"],
  },
];

const customerServiceTemplate = JOBS.find(
  (job) => job.id === "customer-service-associate-clarkconnect",
);

export const EMPLOYER_DEMO_JOBS: JobListing[] = customerServiceTemplate
  ? [
      {
        ...customerServiceTemplate,
        id: "direct-customer-service",
        employerName: "Lumina Tech Solutions",
        summary:
          "Support Lumina Tech customers through phone and chat while documenting clear, timely resolutions.",
        description:
          "Lumina Tech Solutions is hiring a customer service associate for its Angeles City support team. This direct employer listing uses the native JobFinder application flow.",
        postedAt: "2026-07-21T09:00:00+08:00",
        closingAt: "2026-08-21T17:00:00+08:00",
        source: {
          origin: "direct-employer",
          organizationName: "Lumina Tech Solutions",
          organizationType: "employer",
          ownerId: "mock-employer@luminatech.example",
          freshness: "current",
          publishedAt: "2026-07-21T09:00:00+08:00",
          lastSyncedAt: "2026-07-27T08:00:00+08:00",
          applicationMethod: "jobfinder",
          applicationInstructions:
            "Sign in to complete Lumina Tech's JobFinder application form.",
        },
        tags: [
          "Customer service",
          "Direct employer post",
          "On-site",
          "Angeles City",
        ],
      },
    ]
  : [];

export const featuredJobs = JOBS.slice(0, 3);

export function getAllJobs(): JobListing[] {
  const publishedEmployerJobs = getPublishedEmployerJobListings();
  const publishedIds = new Set(publishedEmployerJobs.map((job) => job.id));

  return [
    ...publishedEmployerJobs,
    ...EMPLOYER_DEMO_JOBS.filter((job) => !publishedIds.has(job.id)),
    ...JOBS.filter(
      (job) =>
        !publishedIds.has(job.id) &&
        !EMPLOYER_DEMO_JOBS.some((demoJob) => demoJob.id === job.id),
    ),
  ];
}

export function getJobById(id: string): JobListing | undefined {
  return getAllJobs().find((job) => job.id === id);
}

export function jobSourceLabel(source: JobSource): string {
  if (source.origin === "direct-employer") {
    return "Posted directly by employer";
  }

  return `From ${source.organizationName} dataset`;
}

export function applicationMethodLabel(method: ApplicationMethod): string {
  const labels: Record<ApplicationMethod, string> = {
    jobfinder: "JobFinder application",
    "external-url": "Employer website",
    email: "Email",
    phone: "Phone",
    "in-person": "In person",
  };

  return labels[method];
}
