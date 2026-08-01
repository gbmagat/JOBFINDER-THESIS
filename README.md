# JobFinder — Version 3.2 Backend Update

This version completes the current responsive React frontend integration with the Node.js, Express, and SQLite backend. It includes authentication, persistent job-seeker and company profiles, ontology-based skill matching, Dijkstra accessibility routing, saved jobs, applications, validated employer job posts, applicant review, and PESO/LGU dataset importing.

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
```

The frontend-only release remains available through the `v2.0-frontend` Git tag.
