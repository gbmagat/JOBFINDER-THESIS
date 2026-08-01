import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import {
  createDatabase,
  insertJob,
  isJobAvailable,
  rowToJob,
  skillId,
} from "../src/db.js";
import { calculateSkillMatch, getUserMatch } from "../src/matching.js";
import { SEED_JOBS } from "../src/seed-data.js";
import {
  calculateAccessibilityScore,
  calculateDistanceScore,
  calculateRoute,
} from "../src/routing.js";

let db;
const demoAccounts = {
  employerEmail: "employer-test@example.com",
  jobSeekerEmail: "seeker-test@example.com",
  password: "test-password-123",
};

beforeEach(() => {
  db = createDatabase(":memory:", { seedDemo: true, demoAccounts });
});

afterEach(() => {
  db.close();
});

test("ontology similarity uses one over one plus shortest path distance", () => {
  const result = calculateSkillMatch(
    db,
    ["Computer troubleshooting", "Basic scripting", "Unmapped skill"],
    [
      { id: "computer-troubleshooting", source: "profile" },
      { id: "java", source: "self-reported" },
    ],
  );
  assert.equal(result.exactSkills[0].credit, 1);
  assert.equal(result.relatedSkills[0].credit, 0.33);
  assert.equal(result.missingSkills[0].credit, 0);
  assert.equal(result.skillScore, 44);
});

test("skill IDs preserve punctuation distinctions and ignore case", () => {
  assert.equal(skillId("Java"), skillId("java"));
  assert.notEqual(skillId("C"), skillId("C#"));
  assert.notEqual(skillId("C"), skillId("C++"));
  assert.notEqual(skillId("C#"), skillId("C++"));
});

test("distance score normalizes the Dijkstra distance against the saved limit", () => {
  assert.equal(calculateDistanceScore(0, 10), 100);
  assert.equal(calculateDistanceScore(10, 10), 50);
  assert.equal(calculateDistanceScore(20, 10), 33);
});

test("accessibility score uses the stricter distance or time limit ratio", () => {
  assert.equal(calculateDistanceScore(1, 10), 91);
  assert.equal(calculateAccessibilityScore(1, 10, 120, 30), 20);
  assert.equal(calculateAccessibilityScore(10, 10, 30, 30), 50);
  assert.equal(calculateAccessibilityScore(20, 10, 15, 30), 33);
});

test("Dijkstra returns a textual, estimated route without exposing a home address", () => {
  const route = calculateRoute(db, "balibago", "marquee", {
    maximumDistanceKm: 10,
    maximumMinutes: 35,
  });
  assert.equal(route.distanceKm, 7.8);
  assert.equal(route.estimatedMinutes, 27);
  assert.equal(route.accessibilityStatus, "within-limit");
  assert.equal(route.isEstimate, true);
  assert.match(route.textSummary, /Balibago/);
});

test("Dijkstra handles indirect, reverse, same-location, and unreachable routes", () => {
  db.prepare(`
    UPDATE geo_edges SET distance_km = 20
    WHERE from_node_id = 'balibago' AND to_node_id = 'marquee'
  `).run();
  const indirect = calculateRoute(db, "balibago", "marquee");
  assert.equal(indirect.distanceKm, 9.6);
  assert.equal(indirect.steps.length, 2);

  const reverse = calculateRoute(db, "nepo-center", "balibago");
  assert.match(reverse.steps[0].instruction, /Nepo Center.*Balibago/);

  const sameLocation = calculateRoute(db, "balibago", "balibago");
  assert.equal(sameLocation.mode, "walk");
  assert.equal(sameLocation.distanceKm, 0);
  assert.equal(sameLocation.geometry.coordinates.length, 2);
  assert.deepEqual(
    sameLocation.geometry.coordinates[0],
    sameLocation.geometry.coordinates[1],
  );

  db.prepare(`
    DELETE FROM geo_edges
    WHERE from_node_id = 'marquee' OR to_node_id = 'marquee'
  `).run();
  assert.equal(calculateRoute(db, "balibago", "marquee"), null);
  assert.equal(calculateRoute(db, "unknown", "balibago"), null);
});

test("route status boundaries and the overall 70/30 arithmetic stay explicit", () => {
  const within = calculateRoute(db, "balibago", "nepo-center", {
    maximumDistanceKm: 5.2,
    maximumMinutes: 18,
  });
  assert.equal(within.accessibilityStatus, "within-limit");

  const near = calculateRoute(db, "balibago", "nepo-center", {
    maximumDistanceKm: 5,
    maximumMinutes: 18,
  });
  assert.equal(near.accessibilityStatus, "near-limit");

  const over = calculateRoute(db, "balibago", "nepo-center", {
    maximumDistanceKm: 4,
    maximumMinutes: 18,
  });
  assert.equal(over.accessibilityStatus, "over-limit");

  const seeker = db
    .prepare("SELECT id FROM users WHERE role = 'job-seeker'")
    .get();
  const job = rowToJob(
    db.prepare("SELECT * FROM jobs WHERE id = ?").get(
      "it-support-assistant-lumina-tech",
    ),
  );
  const fit = getUserMatch(db, seeker.id, job);
  assert.equal(
    fit.overallScore,
    Math.round(fit.skillScore * 0.7 + fit.locationScore * 0.3),
  );
});

test("matching stays unavailable until profile details and skills are complete", () => {
  const seeker = db
    .prepare("SELECT id FROM users WHERE role = 'job-seeker'")
    .get();
  const job = rowToJob(
    db.prepare("SELECT * FROM jobs WHERE id = ?").get(
      "it-support-assistant-lumina-tech",
    ),
  );

  db.prepare(
    "UPDATE profiles SET mobile_number = '', barangay = '' WHERE user_id = ?",
  ).run(seeker.id);

  assert.equal(getUserMatch(db, seeker.id, job), null);
});

test("job availability requires active status and a future closing date", () => {
  assert.equal(
    isJobAvailable({ status: "active", closingAt: "2099-01-01T00:00:00Z" }),
    true,
  );
  assert.equal(
    isJobAvailable({ status: "active", closingAt: "2020-01-01T00:00:00Z" }),
    false,
  );
  assert.equal(
    isJobAvailable({ status: "closed", closingAt: "2099-01-01T00:00:00Z" }),
    false,
  );
});

test("demo accounts and jobs are seeded only when explicitly requested", () => {
  const cleanDatabase = createDatabase(":memory:");
  try {
    assert.equal(
      cleanDatabase.prepare("SELECT COUNT(*) AS count FROM users").get().count,
      0,
    );
    assert.equal(
      cleanDatabase.prepare("SELECT COUNT(*) AS count FROM jobs").get().count,
      0,
    );
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM users").get().count, 2);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM jobs").get().count, 3);
  } finally {
    cleanDatabase.close();
  }
});

test("demo seeding repairs job ownership on a later configured restart", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "jobfinder-seed-"));
  const databasePath = path.join(directory, "jobfinder.db");
  try {
    const first = createDatabase(databasePath, { seedDemo: true });
    assert.equal(
      first
        .prepare("SELECT owner_id FROM jobs WHERE id = ?")
        .get("it-support-assistant-lumina-tech").owner_id,
      null,
    );
    first.close();

    const second = createDatabase(databasePath, {
      seedDemo: true,
      demoAccounts,
    });
    assert.equal(
      second
        .prepare("SELECT owner_id FROM jobs WHERE id = ?")
        .get("it-support-assistant-lumina-tech").owner_id,
      "mock-employer@luminatech.example",
    );
    assert.equal(second.prepare("SELECT COUNT(*) AS count FROM jobs").get().count, 3);
    second.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("demo seeding rejects equal account emails", () => {
  assert.throws(
    () =>
      createDatabase(":memory:", {
        seedDemo: true,
        demoAccounts: {
          employerEmail: "same@example.com",
          jobSeekerEmail: "same@example.com",
          password: "test-password-123",
        },
      }),
    /must be different/,
  );
});

test("demo seeding does not take ownership of a conflicting non-seed row", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "jobfinder-collision-"));
  const databasePath = path.join(directory, "jobfinder.db");
  try {
    const first = createDatabase(databasePath);
    const conflictingJob = structuredClone(
      SEED_JOBS.find((job) => job.source.origin === "peso-lgu-dataset"),
    );
    conflictingJob.id = "it-support-assistant-lumina-tech";
    insertJob(first, conflictingJob);
    first.close();

    const second = createDatabase(databasePath, {
      seedDemo: true,
      demoAccounts,
    });
    const row = second
      .prepare("SELECT owner_id, source_json FROM jobs WHERE id = ?")
      .get("it-support-assistant-lumina-tech");
    assert.equal(row.owner_id, null);
    assert.equal(JSON.parse(row.source_json).origin, "peso-lgu-dataset");
    second.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
