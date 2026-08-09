function enabled(value) {
  return /^(1|true|yes)$/i.test(String(value ?? ""));
}

const DEVELOPMENT_DEMO_ACCOUNTS = {
  employerEmail: "employer@demo.com",
  jobSeekerEmail: "jobfinder@demo.com",
  password: "12345678",
};

export function getDemoAccountConfig(config, environment = process.env) {
  if (!config.seedDemo || config.production) return null;

  return {
    employerEmail:
      environment.JOBFINDER_DEMO_EMPLOYER_EMAIL ||
      DEVELOPMENT_DEMO_ACCOUNTS.employerEmail,
    jobSeekerEmail:
      environment.JOBFINDER_DEMO_JOB_SEEKER_EMAIL ||
      DEVELOPMENT_DEMO_ACCOUNTS.jobSeekerEmail,
    pesoLguEmail: environment.JOBFINDER_DEMO_PESO_LGU_EMAIL || undefined,
    password:
      environment.JOBFINDER_DEMO_PASSWORD || DEVELOPMENT_DEMO_ACCOUNTS.password,
  };
}

export function getServerConfig(environment = process.env) {
  const production = environment.NODE_ENV === "production";
  const seedDemo = enabled(environment.JOBFINDER_SEED_DEMO);
  const host = String(
    environment.HOST ?? (production ? "0.0.0.0" : "127.0.0.1"),
  ).trim();
  const port = Number(environment.PORT ?? 4000);

  if (!host) throw new Error("HOST must not be empty.");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer from 1 to 65535.");
  }
  if (production && seedDemo) {
    throw new Error("JOBFINDER_SEED_DEMO must be false in production.");
  }

  return {
    host,
    port,
    production,
    seedDemo,
    trustProxy: enabled(environment.JOBFINDER_TRUST_PROXY),
  };
}
