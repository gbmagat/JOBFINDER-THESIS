# JobFinder

Ontology-Based Skill and Geographic Accessibility Matching for Opportunity Recommendation

JobFinder is a research prototype for job opportunities in Angeles City, Pampanga.
It combines ontology-based skill matching with Dijkstra shortest-path computation
on a road-network graph to rank job recommendations. It includes job-seeker,
employer, and PESO administrator functions.

## Project links

- [Live website](https://jobfinderangeles.site)
- [Docker image](https://hub.docker.com/r/gabmagat/jobfinder)
- [Detailed Docker installation and evaluation guide](DOCKER.md)

## Run with Docker (recommended for evaluators)

Install and start Docker Engine or Docker Desktop with Linux containers enabled.
The published image targets Linux AMD64 (x86-64). Node.js and Git are not required
for this option.

```sh
docker pull gabmagat/jobfinder:latest
docker run -d --name jobfinder --cap-drop ALL --security-opt no-new-privileges:true -p 127.0.0.1:8080:8080 -v jobfinder-data:/data gabmagat/jobfinder:latest
```

Open **http://localhost:8080**. Use this exact hostname for the configured origin.

On first start with a new data volume, the application creates a fresh database
containing the study's job-posting dataset. Register a new job-seeker or employer
account; live-website accounts are not included. There is no default administrator
password. See [DOCKER.md](DOCKER.md) for administrator creation, Compose commands,
and further setup instructions.

Accounts and uploads persist in the `jobfinder-data` volume. Do not delete this
volume unless you intend to delete that local data. Email delivery is disabled by
default, including password-reset emails. Map tiles and external links may require
internet access. This local package is separate from the live website.

### Reproducible submission version

The first published submission image was built from source commit
`db7a8ab2ecafbe49226674adca118d01d2a5de93` and passed the
[publishing workflow's container checks](https://github.com/aizukiontop/Jobfinder/actions/runs/38657853643).
These covered startup, authentication, uploads, and persistence after container
replacement. The `latest` tag may change; use this digest to retrieve that exact image:

```sh
docker pull gabmagat/jobfinder@sha256:37b53eeb387d2dc134b25c86dbd4eb8f7e72054b67b98fb5ee798ccf503e030f
```

## Run from source (developers)

Requirements: Node.js 24 (the version used by the Docker workflow), npm, Git, and
Git LFS for tracked binary assets. Use npm with the committed `package-lock.json`;
there is no need to install dependencies again with pnpm. SQLite is embedded and
does not need a separate database server.

```sh
git lfs install
git clone https://github.com/aizukiontop/Jobfinder.git
cd Jobfinder
git lfs pull
npm ci
```

Run the backend and frontend in **two terminals**, both opened in the cloned
`Jobfinder` folder. The examples below use **Windows PowerShell**. On other shells,
set the same environment variables using that shell's syntax. On Windows, use
`npm.cmd` if PowerShell blocks `npm.ps1`.

### Terminal 1: backend API

```powershell
$env:NODE_ENV = 'development'
$env:JOBFINDER_HOST = '127.0.0.1'
$env:JOBFINDER_PORT = '3210'
$env:JOBFINDER_APP_ORIGIN = 'http://127.0.0.1:8443'
$env:JOBFINDER_SEED_ON_START = '1'
$env:JOBFINDER_MAIL_PROVIDER = 'none'
$env:JOBFINDER_NOTIFICATIONS_ENABLED = '0'
npm.cmd run dev:api
```

The API initializes the schema and seeds the study postings. With no database or
upload-path overrides, local data is stored in `server/data/jobfinder.sqlite` and
`server/uploads/`. Use a fresh development checkout, not a production data directory.

### Terminal 2: frontend

```powershell
$env:JOBFINDER_BASE = '/'
$env:PORT = '8443'
npm.cmd run dev -- --host 127.0.0.1
```

Open **http://127.0.0.1:8443**. Vite proxies `/api` requests to the backend at
`127.0.0.1:3210`. Keep both terminals running. Starting only the frontend does not
start the API or provide working account and database features. If you change the
frontend address, update `JOBFINDER_APP_ORIGIN` to match it and restart the API.

## Checks and build

From the project folder:

```sh
npm run typecheck
npm test
node --test docker/runtime-config.test.mjs
npm run build
```

The build produces frontend files in `dist/`; it does not start or package the API.
The default build base is `/Jobfinder/`. Set `JOBFINDER_BASE=/` before building for
a domain-root deployment, as the Docker build does. The optional VPS service-file
test is skipped in a clean clone because private deployment configuration is not
included; runtime networking tests still run.

## Data and evaluation scope

The repository contains the study's job-posting, skill-ontology, and geographic
assets, not the live site's accounts, resumes, credentials, or production database.
Recruitment records are study data and are not a guarantee of current vacancies.
Computational agreement tests check the implemented algorithms on tested cases;
they do not establish every skill relationship's semantic correctness or actual
travel conditions. Questionnaire ratings describe participant perceptions separately.

Road-network data are derived from [OpenStreetMap](https://www.openstreetmap.org/copyright)
and are subject to the Open Database License. Preserve the applicable data attribution.
Never commit private environment files, API tokens, database copies, or personal uploads.
