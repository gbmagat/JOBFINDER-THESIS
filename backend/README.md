# JobFinder Backend

The backend is a small REST API built with Node.js, Express, and SQLite.

## Main files

- `src/db.js` creates the tables and seed records.
- `src/auth.js` hashes passwords and manages server sessions.
- `src/dataset-import.js` validates and normalizes PESO/LGU job records.
- `src/matching.js` calculates ontology skill evidence and the 70/30 score.
- `src/routing.js` runs Dijkstra over the local route graph.
- `src/routes/` contains the public, account, employer, and PESO/LGU endpoints.
- `src/server.js` starts the API.

## Run the project

From the project root:

```powershell
npm run dev
```

The root development command includes the local demo jobs. Private demo accounts
are created only when their credentials are configured in `backend/.env`.
Start without any demo records using:

```powershell
$env:JOBFINDER_SEED_DEMO="false"
npm run dev
```

Direct backend or production-style startup stays safe by default and does not
seed demo data unless `JOBFINDER_SEED_DEMO` is explicitly enabled.

To configure the private Employer, Job Seeker, and PESO/LGU reviewer accounts, copy
`backend/.env.example` to `backend/.env` and fill in:

- `JOBFINDER_DEMO_EMPLOYER_EMAIL`
- `JOBFINDER_DEMO_JOB_SEEKER_EMAIL`
- `JOBFINDER_DEMO_PESO_LGU_EMAIL`
- `JOBFINDER_DEMO_PASSWORD`

The ignored `.env` file remains on the local computer and is not pushed to
GitHub. The Job Seeker demo includes a completed profile, work preferences,
and skills so personalized matches are available immediately.

The frontend opens through Vite and sends `/api` requests to the backend at
`http://127.0.0.1:4000`.

For the production-style build:

```powershell
npm run build
npm start
```

The backend then serves the built frontend and API from port 4000.

## Persistent storage and backups

Production uses these environment variables for durable storage:

- `JOBFINDER_DATABASE_PATH`
- `JOBFINDER_UPLOADS_PATH`
- `JOBFINDER_BACKUPS_PATH`
- `JOBFINDER_BACKUP_RETENTION_COUNT`

Create and verify an online SQLite and uploads backup from the project root:

```powershell
npm run backup
npm run verify:backup
```

See `DEPLOYMENT.md` in the project root for the persistent-volume, restore,
provisioning, and rollback procedure.

## Authentication rule

Public visitors can browse jobs, job details, dataset sources, and neutral route
estimates. The API requires a signed-in Job Seeker for profiles, saved jobs, and
applications. Applications require an uploaded PDF resume up to 5 MB. Employer
endpoints require an Employer account. Employer-submitted jobs remain hidden
until a PESO/LGU reviewer approves them. Closed listings, unapproved listings,
and listings past their closing date are unavailable for browsing, saving, and
applying.

The `peso-lgu` role is internally provisioned and cannot be selected through
public registration. Its protected `/api/lgu` endpoints provide the verification
overview, employer records and decisions, job-post review decisions, and the
immutable audit log. PESO/LGU dataset imports remain separate from employer-owned
job-post moderation.

The frontend contract uses:

- `GET /api/lgu/overview`
- `GET /api/lgu/verification`
- `GET /api/lgu/verification/jobs/:jobId`
- `POST /api/lgu/verification/jobs/:jobId/decision`
- `GET /api/lgu/employers`
- `GET /api/lgu/employers/:employerId`
- `POST /api/lgu/employers/:employerId/decision`
- `GET /api/lgu/audit-log`

## Import a PESO/LGU JSON dataset

The dataset uses the same job shape returned by the API and must preserve its
source organization, external record ID, dates, and original application
method. Job, location, salary, requirements, route, provenance, and external
application fields are validated before a row is stored.

```powershell
npm run import:peso-lgu -- D:\path\to\dataset.json
```

The importer derives each internal job ID from the source organization and
external record ID. Re-importing the same record therefore updates one row. It
rejects invalid rows, saves an import summary in SQLite, and cannot replace an
employer-owned job. Imports use incremental upsert behavior: records omitted
from a later file are not automatically closed. The source dataset must provide
a closing date or a later update for listings that are no longer available.

The location part of a personalized match uses mapped route distance only. Its
score is `round(100 / (1 + distanceKm / 10))`, where 10 km is a fixed scoring
scale rather than a user limit. Distance changes ranking but never removes an
available job from search results.

## Completed backend behavior

- Employer and Job Seeker authentication uses hashed passwords and server-side
  sessions.
- Full Job Seeker and company profiles persist in SQLite.
- Employer jobs validate contract values, salary, openings, supported route
  nodes, and future application deadlines.
- Employer publication requests enter a pending-review queue and only approved
  jobs become publicly available.
- PESO/LGU reviewer decisions store reviewer identity, timestamp, reason, and an
  immutable audit event.
- A date-only employer deadline is stored as the end of that day in Angeles
  City time.
- Required and preferred job skills are added to the searchable skill catalog.
- Company-name changes update the employer's direct job listings.
- Job ownership protects applicant lists, status changes, and uploaded resumes.
- Dataset records keep their PESO/LGU provenance and original application
  method.
- Route handling covers indirect, reverse, same-location, boundary, and
  unreachable cases.

The algorithm code is complete for the current prototype and keeps the thesis's
70% skill and 30% location formula. Research completion still requires the real
PESO/LGU job data, a validated 33-barangay Angeles City route graph, a larger
expert-reviewed skill ontology, and a labeled evaluation set for precision,
recall, and F1. Those inputs must not be replaced with invented records.
