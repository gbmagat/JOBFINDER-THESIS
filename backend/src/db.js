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

function sanitizeRoute(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const distanceKm = Number.isFinite(value.distanceKm)
    ? value.distanceKm
    : undefined;
  const steps = Array.isArray(value.steps)
    ? value.steps.flatMap((step, index) => {
        if (!step || typeof step !== "object" || Array.isArray(step)) return [];
        const instruction = String(step.instruction ?? "").trim();
        if (!instruction || !Number.isFinite(step.distanceKm)) return [];
        return [{
          order: Number.isFinite(step.order) ? step.order : index + 1,
          instruction,
          distanceKm: step.distanceKm,
        }];
      })
    : [];

  return {
    ...(typeof value.routeId === "string" ? { routeId: value.routeId } : {}),
    ...(typeof value.mode === "string" ? { mode: value.mode } : {}),
    ...(value.geometry && typeof value.geometry === "object"
      ? { geometry: value.geometry }
      : {}),
    ...(distanceKm !== undefined ? { distanceKm } : {}),
    ...(Number.isFinite(value.estimatedFarePhp)
      ? { estimatedFarePhp: value.estimatedFarePhp }
      : {}),
    steps,
    ...(distanceKm !== undefined
      ? { textSummary: `Shortest route distance: ${distanceKm} km.` }
      : {}),
    ...(typeof value.isEstimate === "boolean"
      ? { isEstimate: value.isEstimate }
      : {}),
    ...(Number.isFinite(value.locationScore)
      ? { locationScore: value.locationScore }
      : {}),
  };
}

function migrateUserRoles(db) {
  const table = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'")
    .get();
  if (!table?.sql || table.sql.includes("'peso-lgu'")) return;

  db.pragma("foreign_keys = OFF");
  try {
    const migrate = db.transaction(() => {
      db.exec(`
        DROP TABLE IF EXISTS users_role_migration;
        CREATE TABLE users_role_migration (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE COLLATE NOCASE,
          password_hash TEXT NOT NULL,
          display_name TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('job-seeker', 'employer', 'peso-lgu')),
          created_at TEXT NOT NULL
        );
        INSERT INTO users_role_migration
          (id, email, password_hash, display_name, role, created_at)
        SELECT id, email, password_hash, display_name, role, created_at
        FROM users;
        DROP TABLE users;
        ALTER TABLE users_role_migration RENAME TO users;
      `);
    });
    migrate();
  } finally {
    db.pragma("foreign_keys = ON");
  }

  const violations = db.pragma("foreign_key_check");
  if (violations.length) {
    throw new Error("The user-role migration failed its foreign-key check.");
  }
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('job-seeker', 'employer', 'peso-lgu')),
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
      review_status TEXT NOT NULL DEFAULT 'approved' CHECK (
        review_status IN ('draft', 'pending', 'approved', 'changes-requested', 'rejected')
      ),
      review_reason TEXT NOT NULL DEFAULT '',
      submitted_for_review_at TEXT,
      reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TEXT,
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

    CREATE TABLE IF NOT EXISTS employer_verifications (
      employer_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'verified', 'changes-requested', 'rejected')
      ),
      evidence_json TEXT NOT NULL DEFAULT '[]',
      decision_reason TEXT NOT NULL DEFAULT '',
      reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TRIGGER IF NOT EXISTS audit_events_no_update
    BEFORE UPDATE ON audit_events
    BEGIN
      SELECT RAISE(ABORT, 'Audit events are immutable.');
    END;

    CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
    BEFORE DELETE ON audit_events
    BEGIN
      SELECT RAISE(ABORT, 'Audit events are immutable.');
    END;

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

  migrateUserRoles(db);

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
  if (!jobColumns.has("review_status")) {
    db.exec("ALTER TABLE jobs ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved' CHECK (review_status IN ('draft', 'pending', 'approved', 'changes-requested', 'rejected'))");
  }
  if (!jobColumns.has("review_reason")) {
    db.exec("ALTER TABLE jobs ADD COLUMN review_reason TEXT NOT NULL DEFAULT ''");
  }
  if (!jobColumns.has("submitted_for_review_at")) {
    db.exec("ALTER TABLE jobs ADD COLUMN submitted_for_review_at TEXT");
  }
  if (!jobColumns.has("reviewed_by")) {
    db.exec("ALTER TABLE jobs ADD COLUMN reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL");
  }
  if (!jobColumns.has("reviewed_at")) {
    db.exec("ALTER TABLE jobs ADD COLUMN reviewed_at TEXT");
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS jobs_review_idx
      ON jobs(review_status, created_at DESC);
    CREATE INDEX IF NOT EXISTS employer_verification_status_idx
      ON employer_verifications(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS audit_events_created_idx
      ON audit_events(created_at DESC);
  `);

  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO employer_verifications
      (employer_id, status, evidence_json, decision_reason, updated_at)
    SELECT id, 'pending', '[]', '', ?
    FROM users
    WHERE role = 'employer'
  `).run(now);

  const geoEdgeColumns = new Set(
    db
      .prepare("PRAGMA table_info(geo_edges)")
      .all()
      .map((column) => column.name),
  );
  if (geoEdgeColumns.has("estimated_minutes")) {
    db.exec("ALTER TABLE geo_edges DROP COLUMN estimated_minutes");
  }

  const updateRoute = db.prepare("UPDATE jobs SET route_json = ? WHERE id = ?");
  const sanitizeStoredRoutes = db.transaction(() => {
    for (const row of db.prepare("SELECT id, route_json FROM jobs").all()) {
      const cleaned = json(sanitizeRoute(parse(row.route_json, {})));
      if (cleaned !== row.route_json) updateRoute.run(cleaned, row.id);
    }
  });
  sanitizeStoredRoutes();
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
      from_node_id, to_node_id, distance_km, mode, fare_php, instruction
    ) VALUES (?, ?, ?, ?, ?, ?)
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
        `Travel from ${nodeNames.get(edge[1])} toward ${nodeNames.get(edge[0])}.`,
      );
    }
  });
  transaction();
}

export function insertJob(
  db,
  job,
  ownerId = null,
  status = "active",
  reviewStatus = "approved",
) {
  const now = new Date().toISOString();
  const submittedForReviewAt = reviewStatus === "pending" ? now : null;
  const transaction = db.transaction(() => {
    ensureJobSkills(db, job);
    db.prepare(`
      INSERT INTO jobs (
        id, title, employer_name, summary, description, location_json,
        employment_type, work_arrangement, schedule, opening_count, salary_json, posted_at,
        closing_at, requirements_json, route_json, source_json, tags_json,
        geo_node_id, owner_id, status, review_status, review_reason,
        submitted_for_review_at, reviewed_by, reviewed_at, created_at, updated_at
      ) VALUES (
        @id, @title, @employerName, @summary, @description, @locationJson,
        @employmentType, @workArrangement, @schedule, @openingCount, @salaryJson, @postedAt,
        @closingAt, @requirementsJson, @routeJson, @sourceJson, @tagsJson,
        @geoNodeId, @ownerId, @status, @reviewStatus, '',
        @submittedForReviewAt, NULL, NULL, @createdAt, @updatedAt
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
      routeJson: json(sanitizeRoute(job.route)),
      sourceJson: json(job.source),
      tagsJson: json(job.tags ?? []),
      geoNodeId: job.geoNodeId ?? null,
      ownerId,
      status,
      reviewStatus,
      submittedForReviewAt,
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
        review_status = 'approved',
        review_reason = '',
        submitted_for_review_at = NULL,
        reviewed_by = NULL,
        reviewed_at = NULL,
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
      routeJson: json(sanitizeRoute(job.route)),
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
  const pesoLguEmail = String(accounts?.pesoLguEmail ?? "")
    .trim()
    .toLowerCase();
  const password = String(accounts?.password ?? "");
  if (!employerEmail || !jobSeekerEmail || password.length < 8) return;
  if (employerEmail === jobSeekerEmail) {
    throw new Error("Demo employer and job seeker emails must be different.");
  }
  if (pesoLguEmail && [employerEmail, jobSeekerEmail].includes(pesoLguEmail)) {
    throw new Error("The demo PESO/LGU email must be different from other demo accounts.");
  }

  const now = new Date().toISOString();
  const transaction = db.transaction(() => {
    const employerId = "mock-employer@luminatech.example";
    const defaultSeekerId = "demo-job-seeker";
    const pesoLguId = "demo-peso-lgu";
    const employerEmailOwner = db
      .prepare("SELECT id, role, display_name FROM users WHERE email = ?")
      .get(employerEmail);
    const seekerEmailOwner = db
      .prepare("SELECT id, role, display_name FROM users WHERE email = ?")
      .get(jobSeekerEmail);
    const pesoLguEmailOwner = pesoLguEmail
      ? db
          .prepare("SELECT id, role, display_name FROM users WHERE email = ?")
          .get(pesoLguEmail)
      : null;
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
    const stablePesoLgu = db.prepare("SELECT role FROM users WHERE id = ?").get(pesoLguId);

    if (employerEmailOwner && employerEmailOwner.id !== employerId) {
      throw new Error("The configured demo employer email already belongs to another account.");
    }
    if (seekerEmailOwner && seekerEmailOwner.id !== seekerId) {
      throw new Error("The configured demo job seeker email already belongs to another account.");
    }
    if (pesoLguEmailOwner && pesoLguEmailOwner.id !== pesoLguId) {
      throw new Error("The configured demo PESO/LGU email already belongs to another account.");
    }
    if (stableEmployer && stableEmployer.role !== "employer") {
      throw new Error("The demo employer ID belongs to a different account role.");
    }
    if (stableSeeker && stableSeeker.role !== "job-seeker") {
      throw new Error("The demo job seeker ID belongs to a different account role.");
    }
    if (stablePesoLgu && stablePesoLgu.role !== "peso-lgu") {
      throw new Error("The demo PESO/LGU ID belongs to a different account role.");
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
      INSERT INTO employer_verifications
        (employer_id, status, evidence_json, decision_reason, updated_at)
      VALUES (?, 'verified', ?, '', ?)
      ON CONFLICT(employer_id) DO NOTHING
    `).run(
      employerId,
      json([
        { type: "business-registration", status: "complete" },
        { type: "business-contact", status: "complete" },
        { type: "workplace-address", status: "complete" },
      ]),
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
         home_node_id, preferred_work_types_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO NOTHING
    `).run(
      seekerId,
      "JobFinder Demo User",
      "0917 123 4567",
      "Balibago",
      "Angeles City",
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

    if (pesoLguEmail) {
      db.prepare(`
        INSERT INTO users
          (id, email, password_hash, display_name, role, created_at)
        VALUES (?, ?, ?, ?, 'peso-lgu', ?)
        ON CONFLICT(id) DO UPDATE SET
          email = excluded.email,
          password_hash = excluded.password_hash,
          display_name = excluded.display_name,
          role = excluded.role
      `).run(
        pesoLguId,
        pesoLguEmail,
        hashPassword(password),
        "PESO/LGU Reviewer",
        now,
      );
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
    route: sanitizeRoute(parse(row.route_json, {})),
    source: parse(row.source_json, {}),
    tags: parse(row.tags_json, []),
    status: row.status,
    reviewStatus: row.review_status ?? "approved",
    reviewReason: row.review_reason ?? "",
    submittedForReviewAt: row.submitted_for_review_at ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    ownerId: row.owner_id ?? undefined,
    geoNodeId: row.geo_node_id ?? undefined,
  };
}

export function isJobAvailable(job, now = Date.now()) {
  if (!job || job.status !== "active") return false;
  if (job.reviewStatus && job.reviewStatus !== "approved") return false;
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
    if (filename !== ":memory:") {
      db.pragma("journal_mode = WAL");
      db.pragma("synchronous = FULL");
    }
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
