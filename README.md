# JobFinder — Version 3.4 Profile Completion & Match Logic

This version requires job seekers to complete their personal details, home area, and at least one skill before personalized match percentages appear. Geographic matching is distance-only: every available job stays visible, no commute ceiling is requested, and no estimated travel time is shown.

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
