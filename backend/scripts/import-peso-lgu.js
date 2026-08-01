import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createDatabase, DEFAULT_DATABASE_PATH, upsertDatasetJob } from "../src/db.js";
import { validateAndNormalizeDatasetJob } from "../src/dataset-import.js";

const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!inputPath) {
  console.error("Usage: npm run import:peso-lgu -- path-to-dataset.json");
  process.exit(1);
}

const databasePath = process.env.JOBFINDER_DATABASE_PATH
  ? path.resolve(process.env.JOBFINDER_DATABASE_PATH)
  : DEFAULT_DATABASE_PATH;
const db = createDatabase(databasePath);
const input = JSON.parse(readFileSync(inputPath, "utf8"));
const records = Array.isArray(input) ? input : input.jobs;
if (!Array.isArray(records)) {
  console.error("The JSON file must contain an array or a jobs array.");
  db.close();
  process.exit(1);
}

const errors = [];
let accepted = 0;
const organizationName =
  records.find((record) => record?.source?.organizationName)?.source
    ?.organizationName ?? "PESO/LGU dataset";

const transaction = db.transaction(() => {
  records.forEach((record, index) => {
    try {
      const job = validateAndNormalizeDatasetJob(record);
      if (!db.prepare("SELECT 1 FROM geo_nodes WHERE id = ?").get(job.geoNodeId)) {
        throw new Error("geoNodeId must reference a supported location");
      }
      upsertDatasetJob(db, job);
      accepted += 1;
    } catch (error) {
      errors.push({ row: index + 1, message: error.message });
    }
  });

  db.prepare(`
    INSERT INTO dataset_imports (
      id, file_name, organization_name, total_rows, accepted_rows,
      rejected_rows, errors_json, imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    path.basename(inputPath),
    organizationName,
    records.length,
    accepted,
    errors.length,
    JSON.stringify(errors),
    new Date().toISOString(),
  );
});

transaction();
db.close();
console.log(
  JSON.stringify(
    {
      totalRows: records.length,
      acceptedRows: accepted,
      rejectedRows: errors.length,
      errors,
    },
    null,
    2,
  ),
);
