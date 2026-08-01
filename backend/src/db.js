import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "./auth.js";
import {
  GEO_EDGES,
  GEO_NODES,
  SEED_JOBS,
  SKILL_RELATIONS,
} from "./seed-data.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DATABASE_PATH = path.resolve(
  moduleDirectory,
  "../data/jobfinder.db",
);

function json(value) {
  return JSON.stringify(value ?? null);
}

function parse(value, fallback) {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('job-seeker', 'employer')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL DEFAULT '',
      mobile_number TEXT NOT NULL DEFAULT '',
      barangay TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT 'Angeles City',
      maximum_distance_km REAL NOT NULL DEFAULT 10,
      maximum_minutes INTEGER NOT NULL DEFAULT 35,
      home_node_id TEXT NOT NULL DEFAULT 'balibago',
      preferred_work_types_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );

    CREATE TABLE IF NOT EXISTS user_skills (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      source TEXT NOT NULL DEFAULT 'self-reported',
      PRIMARY KEY (user_id, skill_id)
    );

    CREATE TABLE IF NOT EXISTS skill_relations (
      from_skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      to_skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      PRIMARY KEY (from_skill_id, to_skill_id)
    );

    CREATE TABLE IF NOT EXISTS geo_nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS geo_edges (
      from_node_id TEXT NOT NULL REFERENCES geo_nodes(id) ON DELETE CASCADE,
      to_node_id TEXT NOT NULL REFERENCES geo_nodes(id) ON DELETE CASCADE,
      distance_km REAL NOT NULL CHECK (distance_km >= 0),
      estimated_minutes REAL NOT NULL CHECK (estimated_minutes >= 0),
      mode TEXT NOT NULL,
      fare_php REAL,
      instruction TEXT NOT NULL,
      PRIMARY KEY (from_node_id, to_node_id, mode)
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      employer_name TEXT NOT NULL,
      summary TEXT NOT NULL,
      description TEXT NOT NULL,
      location_json TEXT NOT NULL,
      employment_type TEXT NOT NULL,
      work_arrangement TEXT NOT NULL,
      schedule TEXT,
      opening_count INTEGER NOT NULL DEFAULT 1 CHECK (opening_count >= 1),
      salary_json TEXT NOT NULL,
      posted_at TEXT NOT NULL,
      closing_at TEXT,
      requirements_json TEXT NOT NULL,
      route_json TEXT NOT NULL,
      source_json TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      geo_node_id TEXT REFERENCES geo_nodes(id) ON DELETE SET NULL,
      owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'closed')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_jobs (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (user_id, job_id)
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      applicant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      mobile_number TEXT NOT NULL,
      resume_name TEXT NOT NULL,
      resume_size_bytes INTEGER NOT NULL,
      resume_type TEXT NOT NULL,
      resume_path TEXT,
      message TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Submitted' CHECK (
        status IN ('Submitted', 'Under review', 'Shortlisted', 'Not selected')
      ),
      submitted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (job_id, applicant_id)
    );

    CREATE TABLE IF NOT EXISTS application_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      changed_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      changed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS company_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      company_name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      details_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dataset_imports (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      organization_name TEXT NOT NULL,
      total_rows INTEGER NOT NULL,
      accepted_rows INTEGER NOT NULL,
      rejected_rows INTEGER NOT NULL,
      errors_json TEXT NOT NULL,
      imported_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS jobs_status_posted_idx
      ON jobs(status, posted_at DESC);
    CREATE INDEX IF NOT EXISTS applications_job_idx
      ON applications(job_id, submitted_at DESC);
    CREATE INDEX IF NOT EXISTS applications_applicant_idx
      ON applications(applicant_id, submitted_at DESC);
  `);

  const companyColumns = new Set(
    db
      .prepare("PRAGMA table_info(company_profiles)")
      .all()
      .map((column) => column.name),
  );
  if (!companyColumns.has("details_json")) {
    db.exec("ALTER TABLE company_profiles ADD COLUMN details_json TEXT NOT NULL DEFAULT '{}'");
  }

  const jobColumns = new Set(
    db
      .prepare("PRAGMA table_info(jobs)")
      .all()
      .map((column) => column.name),
  );
  if (!jobColumns.has("opening_count")) {
    db.exec("ALTER TABLE jobs ADD COLUMN opening_count INTEGER NOT NULL DEFAULT 1 CHECK (opening_count >= 1)");
  }
}

export function skillId(name) {
  const canonicalName = String(name)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  const slug = canonicalName
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (/^[a-z0-9]+(?: [a-z0-9]+)*$/.test(canonicalName)) return slug;
  const digest = createHash("sha256")
    .update(canonicalName)
    .digest("hex")
    .slice(0, 10);
  return `${slug || "skill"}-${digest}`;
}

export function ensureSkill(db, name) {
  const cleanName = String(name).normalize("NFKC").trim().replace(/\s+/g, " ");
  const existing = db
    .prepare("SELECT id, name FROM skills WHERE name = ? COLLATE NOCASE")
    .get(cleanName);
  if (existing) return existing;

  let id = skillId(cleanName);
  const idOwner = db.prepare("SELECT name FROM skills WHERE id = ?").get(id);
  if (idOwner) {
    const digest = createHash("sha256")
      .update(cleanName.toLowerCase())
      .digest("hex")
      .slice(0, 16);
    id = `${id}-${digest}`;
  }
  db.prepare("INSERT INTO skills (id, name) VALUES (?, ?)").run(id, cleanName);
  return { id, name: cleanName };
}

export function findSkillId(db, name) {
  return (
    db
      .prepare("SELECT id FROM skills WHERE name = ? COLLATE NOCASE")
      .get(String(name).trim())?.id ?? skillId(name)
  );
}

function ensureJobSkills(db, job) {
  for (const name of [
    ...(job.requirements?.requiredSkills ?? []),
    ...(job.requirements?.preferredSkills ?? []),
  ]) {
    ensureSkill(db, name);
  }
}

function seedSkills(db) {
  const insertRelation = db.prepare(`
    INSERT OR REPLACE INTO skill_relations
      (from_skill_id, to_skill_id)
    VALUES (?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const [left, right] of SKILL_RELATIONS) {
      const leftId = ensureSkill(db, left).id;
      const rightId = ensureSkill(db, right).id;
      insertRelation.run(leftId, rightId);
      insertRelation.run(rightId, leftId);
    }

    for (const job of SEED_JOBS) {
      for (const name of [
        ...job.requirements.requiredSkills,
        ...job.requirements.preferredSkills,
      ]) {
        ensureSkill(db, name);
      }
    }
  });

  transaction();
}

function seedGeography(db) {
  const insertNode = db.prepare(`
    INSERT OR IGNORE INTO geo_nodes (id, name, latitude, longitude)
    VALUES (?, ?, ?, ?)
  `);
  const insertEdge = db.prepare(`
    INSERT OR REPLACE INTO geo_edges (
      from_node_id, to_node_id, distance_km, estimated_minutes,
      mode, fare_php, instruction
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    const nodeNames = new Map(GEO_NODES.map(([id, name]) => [id, name]));
    for (const node of GEO_NODES) insertNode.run(...node);
    for (const edge of GEO_EDGES) {
      insertEdge.run(...edge);
      insertEdge.run(
        edge[1],
        edge[0],
        edge[2],
        edge[3],
        edge[4],
        edge[5],
        `Travel from ${nodeNames.get(edge[1])} toward ${nodeNames.get(edge[0])}.`,
      );
    }
  });
  transaction();
}

export function insertJob(db, job, ownerId = null, status = "active") {
  const now = new Date().toISOString();
  const transaction = db.transaction(() => {
    ensureJobSkills(db, job);
    db.prepare(`
      INSERT INTO jobs (
        id, title, employer_name, summary, description, location_json,
        employment_type, work_arrangement, schedule, opening_count, salary_json, posted_at,
        closing_at, requirements_json, route_json, source_json, tags_json,
        geo_node_id, owner_id, status, created_at, updated_at
      ) VALUES (
        @id, @title, @employerName, @summary, @description, @locationJson,
        @employmentType, @workArrangement, @schedule, @openingCount, @salaryJson, @postedAt,
        @closingAt, @requirementsJson, @routeJson, @sourceJson, @tagsJson,
        @geoNodeId, @ownerId, @status, @createdAt, @updatedAt
      )
    `).run({
      id: job.id,
      title: job.title,
      employerName: job.employerName,
      summary: job.summary,
      description: job.description,
      locationJson: json(job.location),
      employmentType: job.employmentType,
      workArrangement: job.workArrangement,
      schedule: job.schedule ?? null,
      openingCount: job.openingCount ?? 1,
      salaryJson: json(job.salary),
      postedAt: job.postedAt ?? now,
      closingAt: job.closingAt ?? null,
      requirementsJson: json(job.requirements),
      routeJson: json(job.route),
      sourceJson: json(job.source),
      tagsJson: json(job.tags ?? []),
      geoNodeId: job.geoNodeId ?? null,
      ownerId,
      status,
      createdAt: now,
      updatedAt: now,
    });
  });
  transaction();
}

export function upsertDatasetJob(db, job) {
  const transaction = db.transaction(() => {
    const existing = db.prepare("SELECT owner_id FROM jobs WHERE id = ?").get(job.id);
    if (existing?.owner_id) {
      throw new Error("A dataset row cannot replace an employer-owned job.");
    }
    if (!existing) {
      insertJob(db, job, null, "active");
      return;
    }

    ensureJobSkills(db, job);
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE jobs SET
        title = @title,
        employer_name = @employerName,
        summary = @summary,
        description = @description,
        location_json = @locationJson,
        employment_type = @employmentType,
        work_arrangement = @workArrangement,
        schedule = @schedule,
        opening_count = @openingCount,
        salary_json = @salaryJson,
        posted_at = @postedAt,
        closing_at = @closingAt,
        requirements_json = @requirementsJson,
        route_json = @routeJson,
        source_json = @sourceJson,
        tags_json = @tagsJson,
        geo_node_id = @geoNodeId,
        owner_id = NULL,
        status = 'active',
        updated_at = @updatedAt
      WHERE id = @id
    `).run({
      id: job.id,
      title: job.title,
      employerName: job.employerName,
      summary: job.summary,
      description: job.description,
      locationJson: json(job.location),
      employmentType: job.employmentType,
      workArrangement: job.workArrangement,
      schedule: job.schedule ?? null,
      openingCount: job.openingCount ?? 1,
      salaryJson: json(job.salary),
      postedAt: job.postedAt ?? now,
      closingAt: job.closingAt ?? null,
      requirementsJson: json(job.requirements),
      routeJson: json(job.route),
      sourceJson: json(job.source),
      tagsJson: json(job.tags ?? []),
      geoNodeId: job.geoNodeId ?? null,
      updatedAt: now,
    });
  });
  transaction();
}

function seedJobs(db) {
  const transaction = db.transaction(() => {
    for (const job of SEED_JOBS) {
      const ownerId = job.source.ownerId
        ? db.prepare("SELECT id FROM users WHERE id = ?").get(job.source.ownerId)?.id ?? null
        : null;
      const existing = db
        .prepare("SELECT id, owner_id, source_json FROM jobs WHERE id = ?")
        .get(job.id);
      if (!existing) {
        insertJob(db, job, ownerId);
      } else if (ownerId && existing.owner_id !== ownerId) {
        const existingSource = parse(existing.source_json, {});
        const isSameSeedRecord =
          existingSource.origin === job.source.origin &&
          existingSource.ownerId === job.source.ownerId;
        if (isSameSeedRecord) {
          db.prepare("UPDATE jobs SET owner_id = ?, updated_at = ? WHERE id = ?").run(
            ownerId,
            new Date().toISOString(),
            job.id,
          );
        }
      }
    }
  });
  transaction();
}

function seedDemoAccounts(db, accounts) {
  const employerEmail = String(accounts?.employerEmail ?? "")
    .trim()
    .toLowerCase();
  const jobSeekerEmail = String(accounts?.jobSeekerEmail ?? "")
    .trim()
    .toLowerCase();
  const password = String(accounts?.password ?? "");
  if (!employerEmail || !jobSeekerEmail || password.length < 8) return;
  if (employerEmail === jobSeekerEmail) {
    throw new Error("Demo employer and job seeker emails must be different.");
  }

  const now = new Date().toISOString();
  const transaction = db.transaction(() => {
    const employerId = "mock-employer@luminatech.example";
    const defaultSeekerId = "demo-job-seeker";
    const employerEmailOwner = db
      .prepare("SELECT id, role, display_name FROM users WHERE email = ?")
      .get(employerEmail);
    const seekerEmailOwner = db
      .prepare("SELECT id, role, display_name FROM users WHERE email = ?")
      .get(jobSeekerEmail);
    const isLegacyDemoSeeker = Boolean(
      seekerEmailOwner &&
        seekerEmailOwner.role === "job-seeker" &&
        seekerEmailOwner.display_name === "JobFinder Demo User" &&
        String(seekerEmailOwner.id).startsWith("mock-"),
    );
    const seekerId = isLegacyDemoSeeker
      ? seekerEmailOwner.id
      : defaultSeekerId;
    const stableEmployer = db.prepare("SELECT role FROM users WHERE id = ?").get(employerId);
    const stableSeeker = db.prepare("SELECT role FROM users WHERE id = ?").get(seekerId);

    if (employerEmailOwner && employerEmailOwner.id !== employerId) {
      throw new Error("The configured demo employer email already belongs to another account.");
    }
    if (seekerEmailOwner && seekerEmailOwner.id !== seekerId) {
      throw new Error("The configured demo job seeker email already belongs to another account.");
    }
    if (stableEmployer && stableEmployer.role !== "employer") {
      throw new Error("The demo employer ID belongs to a different account role.");
    }
    if (stableSeeker && stableSeeker.role !== "job-seeker") {
      throw new Error("The demo job seeker ID belongs to a different account role.");
    }

    db.prepare(`
      INSERT INTO users
        (id, email, password_hash, display_name, role, created_at)
      VALUES (?, ?, ?, ?, 'employer', ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        password_hash = excluded.password_hash,
        display_name = excluded.display_name,
        role = excluded.role
    `).run(
      employerId,
      employerEmail,
      hashPassword(password),
      "Gabriel Jr.'s Team",
      now,
    );
    db.prepare(`
      INSERT INTO company_profiles
        (user_id, company_name, description, address, website, details_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        website = CASE
          WHEN company_profiles.website = '' THEN excluded.website
          ELSE company_profiles.website
        END,
        details_json = CASE
          WHEN company_profiles.details_json = '{}' THEN excluded.details_json
          ELSE company_profiles.details_json
        END
    `).run(
      employerId,
      "Lumina Tech Solutions",
      "Local technology support and services company.",
      "Sto. Rosario, Angeles City",
      "https://www.luminatech.example",
      json({
        industry: "Information Technology",
        size: "51-200 employees",
        email: "careers@luminatech.example",
        phone: "+63 945 123 4567",
        street: "4/F Nexus Center, MacArthur Highway",
        barangay: "Balibago",
        city: "Angeles City",
        province: "Pampanga",
        benefits:
          "Health coverage\nPaid skills training\nFlexible leave credits\nPerformance incentives",
      }),
      now,
    );

    db.prepare(`
      INSERT INTO users
        (id, email, password_hash, display_name, role, created_at)
      VALUES (?, ?, ?, ?, 'job-seeker', ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        password_hash = excluded.password_hash,
        display_name = excluded.display_name,
        role = excluded.role
    `).run(
      seekerId,
      jobSeekerEmail,
      hashPassword(password),
      "JobFinder Demo User",
      now,
    );
    db.prepare(`
      INSERT INTO profiles
        (user_id, full_name, mobile_number, barangay, city,
         maximum_distance_km, maximum_minutes, home_node_id,
         preferred_work_types_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO NOTHING
    `).run(
      seekerId,
      "JobFinder Demo User",
      "0917 123 4567",
      "Balibago",
      "Angeles City",
      10,
      35,
      "balibago",
      json(["Full-time", "Hybrid"]),
      now,
    );

    const addSkill = db.prepare(`
      INSERT OR IGNORE INTO user_skills (user_id, skill_id, source)
      VALUES (?, ?, 'self-reported')
    `);
    for (const skillName of [
      "Java",
      "Troubleshooting",
      "Windows",
      "Communication",
      "Computer troubleshooting",
      "Customer service",
      "Basic networking",
      "HTML",
      "CSS",
      "JavaScript",
    ]) {
      addSkill.run(seekerId, ensureSkill(db, skillName).id);
    }
  });
  transaction();
}

export function rowToJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    employerName: row.employer_name,
    summary: row.summary,
    description: row.description,
    location: parse(row.location_json, {}),
    employmentType: row.employment_type,
    workArrangement: row.work_arrangement,
    schedule: row.schedule ?? undefined,
    openingCount: row.opening_count ?? 1,
    salary: parse(row.salary_json, {}),
    postedAt: row.posted_at,
    closingAt: row.closing_at ?? undefined,
    requirements: parse(row.requirements_json, {}),
    route: parse(row.route_json, {}),
    source: parse(row.source_json, {}),
    tags: parse(row.tags_json, []),
    status: row.status,
    ownerId: row.owner_id ?? undefined,
    geoNodeId: row.geo_node_id ?? undefined,
  };
}

export function isJobAvailable(job, now = Date.now()) {
  if (!job || job.status !== "active") return false;
  if (!job.closingAt) return true;
  const closingTime = Date.parse(job.closingAt);
  return Number.isFinite(closingTime) && closingTime > now;
}

export function createDatabase(
  filename = DEFAULT_DATABASE_PATH,
  { seedDemo = false, demoAccounts = null } = {},
) {
  if (filename !== ":memory:") {
    mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new Database(filename);
  try {
    db.pragma("foreign_keys = ON");
    if (filename !== ":memory:") db.pragma("journal_mode = WAL");
    createSchema(db);
    seedSkills(db);
    seedGeography(db);
    if (seedDemo) {
      seedDemoAccounts(db, demoAccounts);
      seedJobs(db);
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
