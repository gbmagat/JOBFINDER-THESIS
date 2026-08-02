# JobFinder Deployment Guide

This guide deploys Version 3.9 as one Node.js service that serves both the built React frontend and the Express API. The current release is suitable for a controlled thesis evaluation. The real PESO/LGU dataset is still pending and must not be replaced with invented records.

## Required runtime

- Node.js 22 or newer, or Docker
- HTTPS for production sign-in cookies
- One persistent storage volume
- A scheduled task for backups

## Production environment

| Variable | Production value | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `production` | Enables secure session cookies and production startup checks. |
| `HOST` | `0.0.0.0` | Makes the service reachable through container or platform ingress. |
| `PORT` | Platform-provided or `4000` | HTTP port used by the service. |
| `JOBFINDER_TRUST_PROXY` | `true` only behind one trusted proxy | Uses the first proxy hop for Express request information. |
| `JOBFINDER_SEED_DEMO` | `false` | Production refuses to start if demo seeding is enabled. |
| `JOBFINDER_DATABASE_PATH` | Persistent path such as `/app/storage/jobfinder.db` | Stores accounts, profiles, jobs, applications, and sessions. |
| `JOBFINDER_UPLOADS_PATH` | Persistent path such as `/app/storage/uploads` | Stores uploaded PDF resumes. |
| `JOBFINDER_BACKUPS_PATH` | Persistent path such as `/app/storage/backups` | Stores completed local backup snapshots. |
| `JOBFINDER_BACKUP_RETENTION_COUNT` | `7` or another value from 1 to 100 | Keeps the newest completed backups. |

Do not configure the three demo-account variables in production. Keep the database, uploads, and backups out of the public web root.

## Deploy with Docker

Build the image:

```powershell
docker build -t jobfinder:3.9 .
```

Run it with a persistent volume:

```powershell
docker run -d --name jobfinder -p 4000:4000 -v jobfinder-storage:/app/storage jobfinder:3.9
```

The Docker image sets the production host and storage paths. A hosting platform may provide `PORT` automatically. Add `JOBFINDER_TRUST_PROXY=true` only when the platform has exactly one trusted proxy hop.

## Deploy directly with Node.js

```powershell
npm ci --prefix frontend
npm ci --prefix backend
npm run build
$env:NODE_ENV="production"
$env:HOST="0.0.0.0"
$env:PORT="4000"
$env:JOBFINDER_SEED_DEMO="false"
$env:JOBFINDER_DATABASE_PATH="D:\JobFinderData\jobfinder.db"
$env:JOBFINDER_UPLOADS_PATH="D:\JobFinderData\uploads"
$env:JOBFINDER_BACKUPS_PATH="D:\JobFinderData\backups"
npm start
```

The service must have read and write permission for all three storage paths. Visit `/api/health` after startup.

## Provision the controlled thesis demo

A fresh production database intentionally contains no demo jobs. Until the real PESO/LGU dataset is available:

1. Restrict the deployment to the thesis team and approved evaluators.
2. Register one controlled Employer account.
3. Complete its company profile and publish at least one clearly labeled evaluation vacancy.
4. Register controlled Job Seeker accounts and complete their profiles and skills.
5. Confirm that guests see no match percentage and completed Job Seekers do.

Do not enable `JOBFINDER_SEED_DEMO` in production. Broad public access should wait for employer verification, authentication rate limits, and resume malware scanning.

## Back up

Run this daily through the hosting platform scheduler:

```powershell
npm run backup
```

The command uses SQLite's online backup API, copies the uploads directory, writes SHA-256 checksums, verifies database integrity, and applies retention only after a complete snapshot exists.

Verify the newest backup:

```powershell
npm run verify:backup
```

Verify a specific backup:

```powershell
npm run verify:backup -- "D:\JobFinderData\backups\jobfinder-YYYY-MM-DDTHH-MM-SS-SSSZ"
```

Backups contain personal information and resumes. Restrict access and copy completed snapshots to a separate encrypted or provider-managed location. A backup on the same volume is not sufficient protection from volume loss.

## Restore

1. Stop the JobFinder service so no writes occur during restoration.
2. Run `npm run verify:backup -- <backup-directory>`.
3. Preserve the current database and uploads as a rollback copy.
4. Copy the verified `jobfinder.db` and `uploads` from the backup into the configured storage paths.
5. Restore to the same uploads path used when the backup was created because application records reference that path.
6. Start the service and check `/api/health`.
7. Sign in, open a job, and verify an authorized resume download.
8. Run `npm run backup` again after the restored service is confirmed.

## Roll back an application release

Keep the previous container image or Git commit available. Stop the new service, restore the last verified storage snapshot only when a data rollback is required, deploy the previous application version, then repeat the health and account checks. Application rollback and data rollback are separate decisions.
