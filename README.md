# JobFinder - Version 4.5 Easy Local Setup

JobFinder is a responsive React, Express, and SQLite thesis prototype for explainable skill and geographic job matching. Guests can browse jobs without match percentages. Personalized scores appear only after a signed-in Job Seeker completes the required profile details and skills.

The frontend and backend are connected. Employer-created jobs, accounts, profiles, applications, uploaded PDF resumes, sessions, employer verification, job-post decisions, and the immutable review log persist in SQLite and protected storage. The real PESO/LGU dataset is still pending and is not replaced with invented production data.

Version 3.9 prevents local environment files, databases, uploads, and backups from entering the Docker build context or runtime image.

Version 4.0 reduces accidental-publication risk by ignoring common private thesis files and sensitive runtime artifacts, then checking that sensitive paths are not already tracked by Git.

Version 4.1 adds the restricted PESO/LGU reviewer workspace, employer and job-post verification, subdomain-aware access, an immutable Audit Log, and lifecycle protection that withdraws approved jobs when an employer loses verification.

Version 4.4 replaces raw response-parsing failures with clear server-connection guidance and documents the complete fresh-clone startup procedure.

Version 4.5 makes local setup safe to rerun on Windows without deleting the entire dependency folder first.

## Mapping prototype

JobFinder displays OpenStreetMap tiles with required attribution, while the
backend calculates route distance and geometry with JobFinder's own Dijkstra
implementation. Leaflet only draws the returned GeoJSON line; it does not
calculate the route.

The current thesis seed contains a small four-node Angeles City demonstration
graph. Its lines are graph previews, not turn-by-turn navigation. Importing a
larger road graph, preserving road-edge geometry, and snapping a user's live
position to the nearest supported node are separate dataset steps.

For local testing, the frontend defaults to OpenStreetMap's public tile server.
Before a public production launch, configure `VITE_MAP_TILE_URL` at frontend
build time for a tile provider whose capacity and terms fit the deployment.
Do not bulk-download or offline-cache public OpenStreetMap tiles.

## Run locally

Use Node.js 22 or newer. From the repository root, install all three package
groups and start the frontend and backend together:

```powershell
npm run setup
npm run dev
```

Run `npm run setup` once after downloading the project or whenever dependencies
change. Stop any running JobFinder command with `Ctrl+C` before updating
dependencies. For normal use after setup, only `npm run dev` is required.

If Windows reports `EPERM` for a native `.node` file, close the running
JobFinder terminal and rerun `npm run setup`. Do not delete `node_modules` while
the development server is running.

The terminal should show the backend on `http://127.0.0.1:4000` and the
frontend Vite address. Do not start only `frontend`, because account actions
need the backend API. VS Code Live Server, opening `frontend/dist` directly,
and GitHub Pages are not supported for sign-in because they do not run the
Express API.

Private demo-account values are intentionally not stored in GitHub. To use the
shared Employer and Job Seeker demo accounts, obtain `backend/.env` from the
project owner through a private channel. Alternatively, copy
`backend/.env.example` to the ignored `backend/.env`, provide your own demo
emails and password, and keep `JOBFINDER_SEED_DEMO=true` while running locally.

If the interface opens but sign-in cannot reach the server, confirm that
`http://127.0.0.1:4000/api/health` returns JSON, then stop the running commands
and start the project again from the repository root with `npm run dev`.

## Verify the release

```powershell
npm run release:check
```

This runs frontend/backend checks and unit tests, builds the production frontend, completes the critical browser journeys, and starts the real production server against temporary storage for a final smoke test.

## Production operations

```powershell
npm run build
npm start
npm run backup
npm run verify:backup
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for environment, persistent storage, backup, restore, provisioning, and rollback instructions. Use [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) before a controlled thesis evaluation.

Earlier milestones remain available through their Git history and release tags, including `v2.0-frontend`, `v3.2-backend-update`, and `v3.5-distance-only-matching`.
