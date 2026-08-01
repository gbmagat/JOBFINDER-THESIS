import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { createDatabase, isJobAvailable, skillId } from "../src/db.js";
import { calculateSkillMatch } from "../src/matching.js";
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
