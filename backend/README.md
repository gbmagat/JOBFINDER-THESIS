# JobFinder Backend

The backend is a small REST API built with Node.js, Express, and SQLite.

## Main files

- `src/db.js` creates the tables and seed records.
- `src/auth.js` hashes passwords and manages server sessions.
- `src/dataset-import.js` validates and normalizes PESO/LGU job records.
- `src/matching.js` calculates ontology skill evidence and the 70/30 score.
- `src/routing.js` runs Dijkstra over the local route graph.
- `src/routes/` contains the public, account, and employer endpoints.
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

To configure the private Employer and Job Seeker accounts, copy
`backend/.env.example` to `backend/.env` and fill in:

- `JOBFINDER_DEMO_EMPLOYER_EMAIL`
- `JOBFINDER_DEMO_JOB_SEEKER_EMAIL`
- `JOBFINDER_DEMO_PASSWORD`

The ignored `.env` file remains on the local computer and is not pushed to
GitHub. The Job Seeker demo includes a completed profile, travel preferences,
and skills so personalized matches are available immediately.

The frontend opens through Vite and sends `/api` requests to the backend at
`http://127.0.0.1:4000`.

For the production-style build:

```powershell
npm run build
npm start
```

The backend then serves the built frontend and API from port 4000.

## Authentication rule

Public visitors can browse jobs, job details, dataset sources, and neutral route
estimates. The API requires a signed-in Job Seeker for profiles, saved jobs, and
applications. Applications require an uploaded PDF resume up to 5 MB. Employer
endpoints require an Employer account. Closed listings and listings past their
closing date are unavailable for browsing, saving, and applying.

PESO and LGU organizations are dataset sources only. They do not have accounts
or an administrator dashboard.

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
employer-owned job.

The location part of a personalized match uses the stricter ratio between the
saved distance limit and saved travel-time limit. A short but unusually slow
route therefore cannot receive an incorrectly high accessibility score.
