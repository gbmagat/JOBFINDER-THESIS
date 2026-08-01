# JobFinder — Version 3.3 QA Update

This version verifies the connected responsive React frontend and Node.js, Express, and SQLite backend with real browser journeys. It covers public browsing, protected authentication, PDF application submission, employer job publishing and applicant shortlisting, and mobile session persistence and sign-out.

## Run locally

```powershell
npm install --prefix frontend
npm install --prefix backend
npm run dev
```

The frontend opens through Vite and sends API requests to the backend. Development mode includes demo jobs and supports private Employer and Job Seeker accounts configured through the ignored `backend/.env` file.

## Checks

```powershell
npm run check
npm test
npm run build
npm run test:e2e
```

The frontend-only release remains available through the `v2.0-frontend` Git tag, and the previous connected backend release remains available through `v3.2-backend-update`.
