# JobFinder Version 3.9 Release Checklist

## Before deployment

- [ ] Confirm only intended source files are committed.
- [ ] Install dependencies with `npm ci`, `npm ci --prefix frontend`, and `npm ci --prefix backend`.
- [ ] Run `npm run release:check` and keep the passing output.
- [ ] Confirm `npm run check:docker` reports that private storage is excluded.
- [ ] Build the Docker image on a machine with Docker because Docker is not installed on the current development computer.
- [ ] Set `NODE_ENV=production`, `HOST=0.0.0.0`, and `JOBFINDER_SEED_DEMO=false`.
- [ ] Configure persistent database, uploads, and backup paths on one mounted volume.
- [ ] Confirm HTTPS is enabled before testing sign-in.
- [ ] Leave PESO/LGU import deferred until the real approved dataset is received.

## Controlled evaluation data

- [ ] Restrict access to the thesis team and approved evaluators.
- [ ] Register a controlled Employer and complete its company profile.
- [ ] Publish at least one clearly labeled evaluation vacancy.
- [ ] Register a Job Seeker and complete personal details, home area, and skills.
- [ ] Confirm a guest sees jobs but no match percentage.
- [ ] Confirm the completed Job Seeker receives explainable skill and distance scores.
- [ ] Submit a PDF resume and confirm only the applicant and owning Employer can open it.

## After deployment

- [ ] `/api/health` returns `status: ok`.
- [ ] The home page and direct client-side routes load successfully.
- [ ] Sign in, sign out, profile editing, job posting, saving, and applying work.
- [ ] Restart the service and confirm accounts, jobs, applications, and resumes remain available.
- [ ] Run `npm run backup` and `npm run verify:backup`.
- [ ] Copy a completed backup to a separate protected location.
- [ ] Record the deployed Git commit, image version, date, operator, and rollback version.

## Broad public launch gates

These are not blockers for a restricted thesis evaluation, but they must be completed before unrestricted public access:

- [ ] Employer identity approval before job publication.
- [ ] Login, registration, and application rate limits plus a password length cap.
- [ ] Resume quarantine and malware scanning.
- [ ] A production hosting/privacy review for personal information retention and deletion.
- [ ] The validated PESO/LGU dataset, 33-barangay route graph, reviewed ontology, and labeled evaluation set.
