export const SKILL_RELATIONS = [
  ["Computer troubleshooting", "Troubleshooting"],
  ["Computer troubleshooting", "Technical support"],
  ["Customer support", "Customer service"],
  ["Customer service", "Active listening"],
  ["Basic networking", "Computer networking"],
  ["Java", "Programming"],
  ["Programming", "Basic scripting"],
  ["Windows", "Windows administration"],
  ["Communication", "Spoken English"],
  ["Communication", "Case documentation"],
  ["JavaScript", "React"],
  ["HTML", "Responsive web design"],
  ["CSS", "Responsive web design"],
];

export const GEO_NODES = [
  ["balibago", "Balibago", 15.1667, 120.5874],
  ["nepo-center", "Nepo Center", 15.1458, 120.5882],
  ["balibago-business", "Balibago Business Center", 15.1659, 120.5881],
  ["marquee", "Marquee Business Park", 15.1571, 120.6098],
];

export const GEO_EDGES = [
  [
    "balibago",
    "nepo-center",
    5.2,
    18,
    "public-transport",
    26,
    "Take local public transport from Balibago toward Nepo Center.",
  ],
  [
    "balibago",
    "balibago-business",
    3.1,
    38,
    "walk",
    0,
    "Follow the main pedestrian route to Balibago Business Center.",
  ],
  [
    "balibago",
    "marquee",
    7.8,
    27,
    "public-transport",
    32,
    "Take local public transport from Balibago toward Marquee.",
  ],
  [
    "nepo-center",
    "marquee",
    4.4,
    16,
    "public-transport",
    24,
    "Take local public transport from Nepo Center toward Marquee.",
  ],
];

export const SEED_JOBS = [
  {
    id: "it-support-assistant-lumina-tech",
    geoNodeId: "nepo-center",
    title: "IT Support Assistant",
    employerName: "Lumina Tech Solutions",
    summary:
      "Support employee workstations, resolve everyday technical issues, and help maintain reliable office connectivity.",
    description:
      "Lumina Tech Solutions is looking for an entry-level IT support professional who can explain technical steps clearly and keep accurate service records.",
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
      minimumPhp: 19000,
      maximumPhp: 24000,
      period: "month",
      negotiable: false,
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
        "Estimated 5.2 km and 18 minutes from Balibago using local public transport.",
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
      applicationMethod: "jobfinder",
      applicationInstructions:
        "Sign in to complete the employer's JobFinder application form.",
    },
    tags: ["Entry level", "IT support", "On-site", "Angeles City"],
  },
  {
    id: "customer-service-associate-clarkconnect",
    geoNodeId: "balibago-business",
    title: "Customer Service Associate",
    employerName: "ClarkConnect Services",
    summary:
      "Assist customers through phone and chat, document concerns, and coordinate timely resolutions with service teams.",
    description:
      "This vacancy was supplied through an Angeles City PESO dataset and keeps the source record's original application method.",
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
      minimumPhp: 20000,
      maximumPhp: 27000,
      period: "month",
      negotiable: false,
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
      education: "At least senior high school graduate or equivalent",
      experience: "Customer-facing experience is useful but not required",
      responsibilities: [
        "Respond to customer questions through phone and chat",
        "Record concerns and actions accurately",
        "Follow service procedures and escalation paths",
        "Coordinate with internal teams on unresolved cases",
      ],
      additionalRequirements: [
        "Willing to work rotating schedules",
        "Confirm documentary requirements with Angeles City PESO",
      ],
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
        "Estimated 3.1 km and 38 minutes on foot to Balibago Business Center.",
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
        "Email your resume and include record ACPESO-2026-0718-044 in the subject.",
    },
    tags: ["Customer service", "PESO dataset", "On-site", "Angeles City"],
  },
  {
    id: "junior-web-developer-pixelnorth",
    geoNodeId: "marquee",
    title: "Junior Web Developer",
    employerName: "PixelNorth Digital Studio",
    summary:
      "Build and maintain responsive client websites with a small product team using modern HTML, CSS, and JavaScript.",
    description:
      "PixelNorth Digital Studio is seeking a junior developer who enjoys turning interface designs into accessible, responsive pages.",
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
      minimumPhp: 24000,
      maximumPhp: 32000,
      period: "month",
      negotiable: true,
    },
    postedAt: "2026-07-23T10:15:00+08:00",
    closingAt: "2026-08-20T17:00:00+08:00",
    requirements: {
      requiredSkills: ["HTML", "CSS", "JavaScript", "Responsive web design"],
      preferredSkills: ["React", "Git", "Web accessibility"],
      education:
        "Portfolio, technical-vocational training, or college coursework demonstrating web-development fundamentals",
      experience: "Entry-level applicants are welcome",
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
          instruction: "Take local public transport toward Marquee.",
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
        "Estimated 7.8 km and 27 minutes from Balibago using local public transport.",
      accessibilityStatus: "near-limit",
      isEstimate: true,
    },
    source: {
      origin: "direct-employer",
      organizationName: "PixelNorth Digital Studio",
      organizationType: "employer",
      freshness: "current",
      publishedAt: "2026-07-23T10:15:00+08:00",
      sourceUrl: "https://careers.example.org/",
      applicationMethod: "external-url",
      applicationTarget:
        "https://careers.example.org/jobs/junior-web-developer",
      applicationInstructions:
        "Continue on the employer's careers website after signing in.",
    },
    tags: ["Web development", "Hybrid", "External application", "Angeles City"],
  },
];
