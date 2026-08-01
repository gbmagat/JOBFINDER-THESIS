# JobFinder — Version 3.0 Connected Frontend & Backend

This version connects the responsive React frontend to a Node.js, Express, and SQLite backend. It includes authentication, job-seeker profiles, ontology-based skill matching, geographic accessibility scoring, saved jobs, applications, employer job posts, and applicant review.

## Run locally

```powershell
npm install --prefix frontend
npm install --prefix backend
npm run dev
```

The frontend opens through Vite and sends API requests to the backend. Development mode includes demo jobs and an Employer account documented in `backend/README.md`.

## Checks

```powershell
npm run check
npm test
npm run build
```

The frontend-only release remains available through the `v2.0-frontend` Git tag.
