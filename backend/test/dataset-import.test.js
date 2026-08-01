import assert from "node:assert/strict";
import { test } from "node:test";
import {
  datasetJobId,
  validateAndNormalizeDatasetJob,
} from "../src/dataset-import.js";
import { createDatabase, upsertDatasetJob } from "../src/db.js";
import { SEED_JOBS } from "../src/seed-data.js";

function sourceRecord() {
  return structuredClone(
    SEED_JOBS.find((job) => job.source.origin === "peso-lgu-dataset"),
  );
}

test("dataset IDs are stable for an organization and external record", () => {
  const record = sourceRecord();
  const normalized = validateAndNormalizeDatasetJob(record);
  const repeated = sourceRecord();
  repeated.id = "a-different-client-id";
  repeated.source.organizationName = `  ${repeated.source.organizationName.toUpperCase()}  `;

  assert.equal(
    normalized.id,
    datasetJobId(
      record.source.organizationName,
      record.source.externalRecordId,
    ),
  );
  assert.equal(validateAndNormalizeDatasetJob(repeated).id, normalized.id);
});

test("dataset validation rejects incomplete job shapes", () => {
  const invalidRecords = [
    ["title", (job) => delete job.title],
    ["location.city", (job) => delete job.location.city],
    ["requirements.requiredSkills", (job) => (job.requirements.requiredSkills = [])],
    ["route.textSummary", (job) => delete job.route.textSummary],
    ["source.datasetName", (job) => delete job.source.datasetName],
    ["source.applicationTarget", (job) => delete job.source.applicationTarget],
  ];

  for (const [field, invalidate] of invalidRecords) {
    const record = sourceRecord();
    invalidate(record);
    assert.throws(
      () => validateAndNormalizeDatasetJob(record),
      new RegExp(String(field).replace(".", "\\.")),
    );
  }
});

test("dataset validation enforces contract values and deduplicates skills", () => {
  const invalidEmploymentType = sourceRecord();
  invalidEmploymentType.employmentType = "Permanent";
  assert.throws(
    () => validateAndNormalizeDatasetJob(invalidEmploymentType),
    /employmentType is invalid/,
  );

  const invalidRouteMode = sourceRecord();
  invalidRouteMode.route.mode = "teleport";
  assert.throws(
    () => validateAndNormalizeDatasetJob(invalidRouteMode),
    /route.mode is invalid/,
  );

  const duplicated = sourceRecord();
  duplicated.requirements.requiredSkills = [
    "Java",
    " java ",
    "JAVA",
    "Customer service",
  ];
  const normalized = validateAndNormalizeDatasetJob(duplicated);
  assert.deepEqual(normalized.requirements.requiredSkills, [
    "Java",
    "Customer service",
  ]);
});

test("re-importing a source record updates one stable database row", () => {
  const db = createDatabase(":memory:");
  try {
    const first = validateAndNormalizeDatasetJob(sourceRecord());
    upsertDatasetJob(db, first);

    const changedRecord = sourceRecord();
    changedRecord.id = "another-client-generated-id";
    changedRecord.title = "Updated Customer Service Associate";
    changedRecord.requirements.requiredSkills.push("Imported Unique Skill");
    changedRecord.requirements.preferredSkills.push("Imported Preferred Skill");
    const changed = validateAndNormalizeDatasetJob(changedRecord);
    upsertDatasetJob(db, changed);

    assert.equal(changed.id, first.id);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM jobs").get().count, 1);
    assert.equal(
      db.prepare("SELECT title FROM jobs WHERE id = ?").get(first.id).title,
      "Updated Customer Service Associate",
    );
    assert.deepEqual(
      new Set(
        db
          .prepare("SELECT name FROM skills WHERE name LIKE 'Imported %' ORDER BY name")
          .all()
          .map((skill) => skill.name),
      ),
      new Set(["Imported Preferred Skill", "Imported Unique Skill"]),
    );
  } finally {
    db.close();
  }
});
