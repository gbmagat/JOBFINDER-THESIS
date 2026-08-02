# JobFinder - Version 4.1 PESO/LGU Verification Workspace

JobFinder is a responsive React, Express, and SQLite thesis prototype for explainable skill and geographic job matching. Guests can browse jobs without match percentages. Personalized scores appear only after a signed-in Job Seeker completes the required profile details and skills.

The frontend and backend are connected. Employer-created jobs, accounts, profiles, applications, uploaded PDF resumes, sessions, employer verification, job-post decisions, and the immutable review log persist in SQLite and protected storage. The real PESO/LGU dataset is still pending and is not replaced with invented production data.

Version 3.9 prevents local environment files, databases, uploads, and backups from entering the Docker build context or runtime image.

Version 4.0 reduces accidental-publication risk by ignoring common private thesis files and sensitive runtime artifacts, then checking that sensitive paths are not already tracked by Git.

Version 4.1 adds the restricted PESO/LGU reviewer workspace, employer and job-post verification, subdomain-aware access, an immutable Audit Log, and lifecycle protection that withdraws approved jobs when an employer loses verification.

## Run locally

```powershell
npm ci
npm ci --prefix frontend
npm ci --prefix backend
npm run dev
```

Copy `backend/.env.example` to the ignored `backend/.env` only when private local demo accounts are needed.

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
