# JobFinder frontend designs — Version 1.1

These PNG files were exported from the live editable Figma file on 2026-08-01:

- [JobFinder Figma source](https://www.figma.com/design/cwDpgv3V0L3rGx8e8QXAf1)
- Source release label: `Version 1.1, Frontend`
- Exported screen files: **34**
- Product roles represented: job seeker/public and employer

Only Figma frames that map to a currently implemented website route or UI state are included. Legacy Version 1.0 explorations, duplicated audit sheets, superseded layouts, the former PESO/admin archive, component/foundation pages, and the unimplemented mobile location-permission screen are intentionally excluded.

## Desktop — 1440 px

| File | Figma node | Website route/state |
| --- | --- | --- |
| `desktop/job-seeker/01-public-home.png` | `196:2` | `/` guest home |
| `desktop/job-seeker/02-job-search.png` | `196:63` | `/jobs` |
| `desktop/job-seeker/03-job-detail.png` | `196:149` | `/jobs/:jobId` guest detail |
| `desktop/job-seeker/04-profile.png` | `196:218` | `/profile` |
| `desktop/job-seeker/05-application.png` | `196:296` | `/jobs/:jobId/apply` |
| `desktop/employer/01-dashboard.png` | `196:350` | `/employer` |
| `desktop/employer/02-post-job.png` | `196:435` | `/employer/posts/new` |
| `desktop/employer/03-candidate-matches.png` | `196:492` | `/employer/candidates` and post candidates |

## 1024 px reference frames

| File | Figma node | Website route/state |
| --- | --- | --- |
| `tablet/job-seeker/01-public-home.png` | `198:2` | `/` guest home |
| `tablet/job-seeker/02-job-search.png` | `198:55` | `/jobs` |
| `tablet/job-seeker/03-job-detail.png` | `198:123` | `/jobs/:jobId` guest detail |
| `tablet/job-seeker/04-profile.png` | `198:180` | `/profile` |
| `tablet/job-seeker/05-application.png` | `198:248` | `/jobs/:jobId/apply` |
| `tablet/employer/01-dashboard.png` | `198:292` | `/employer` |
| `tablet/employer/02-post-job.png` | `198:358` | `/employer/posts/new` |
| `tablet/employer/03-candidate-matches.png` | `198:403` | Employer candidate routes |

The Figma frames are named `T01`–`T08`, but their 1024 px width activates the website's desktop top-navigation breakpoint. The true 640–1023 px tablet-rail layout does not yet have a dedicated Version 1.1 Figma frame.

## Mobile — 390 px

| File | Figma node | Website route/state |
| --- | --- | --- |
| `mobile/job-seeker/01-public-home.png` | `199:2` | `/` guest home |
| `mobile/job-seeker/02-job-search.png` | `199:53` | `/jobs` |
| `mobile/job-seeker/03-job-detail.png` | `199:110` | `/jobs/:jobId` |
| `mobile/job-seeker/04-route-accessibility.png` | `11:53` | `/jobs/:jobId/route` |
| `mobile/job-seeker/05-sign-in-to-apply.png` | `10:53` | Contextual `/sign-in` |
| `mobile/job-seeker/06-profile-setup-personal.png` | `10:84` | `/onboarding/profile` |
| `mobile/job-seeker/07-profile-setup-skills.png` | `10:115` | `/onboarding/skills` |
| `mobile/job-seeker/08-skill-search-state.png` | `155:36` | Skill-search state inside onboarding |
| `mobile/job-seeker/09-apply-step-1-details.png` | `199:213` | Application Step 1 |
| `mobile/job-seeker/10-apply-step-3-review.png` | `129:67` | Application Step 3 |
| `mobile/job-seeker/11-applications.png` | `11:84` | `/applications` |
| `mobile/job-seeker/12-profile.png` | `199:160` | `/profile` |
| `mobile/job-seeker/13-search-no-results.png` | `86:3` | `/jobs` no-results state |
| `mobile/job-seeker/14-search-offline.png` | `86:4` | `/jobs?state=offline` |
| `mobile/job-seeker/16-job-expired.png` | `86:6` | `/jobs/:jobId?state=expired` |
| `mobile/employer/01-dashboard.png` | `199:245` | `/employer` |
| `mobile/employer/02-post-job.png` | `199:294` | `/employer/posts/new` |
| `mobile/employer/03-candidate-matches.png` | `199:346` | Employer candidate routes |

## Current coverage gaps

The website currently has implemented views without dedicated Version 1.1 Figma frames, including `/saved`, `/preferences`, `/register`, `/about/data-sources`, 404, `/employer/posts`, `/employer/company`, intermediate/success steps, and true tablet-rail layouts. No placeholder exports were added for those views.
