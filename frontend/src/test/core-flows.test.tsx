import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  AUTH_USER_STORAGE_KEY,
  AuthProvider,
} from "../features/auth/AuthContext";
import { sanitizeEmployerReturnTo } from "../features/auth/auth-intent";
import { getAllJobs } from "../features/jobs/data";
import { userStorageKey } from "../lib/storage-keys";
import { usePersistentState } from "../lib/usePersistentState";
import {
  EMPLOYER_APPLICATION_INBOX_STORAGE_KEY,
  type StoredSubmittedApplication,
} from "../features/applications/storage-contract";
import {
  readApplicationReviewStatuses,
  toApplicantApplicationStatus,
} from "../features/applications/submitted-storage";
import { CandidateMatchesPage } from "../pages/CandidateMatchesPage";
import { EmployerPage } from "../pages/EmployerPage";
import EmployerPostsPage from "../pages/EmployerPostsPage";
import { EMPLOYER_PUBLISHED_POSTS_STORAGE_KEY } from "../features/jobs/employer-posts";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("account-scoped browser storage", () => {
  it("keeps private records isolated while leaving public records unscoped", () => {
    const baseKey = "jobfinder.saved-job-ids.v1";
    const gabrielKey = userStorageKey(
      baseKey,
      "mock-gabriel+seeker@example.com",
    );
    const employerKey = userStorageKey(baseKey, "mock-team@example.com");

    expect(gabrielKey).not.toBe(baseKey);
    expect(employerKey).not.toBe(baseKey);
    expect(gabrielKey).not.toBe(employerKey);
    expect(gabrielKey).toContain(
      encodeURIComponent("mock-gabriel+seeker@example.com"),
    );
    expect(userStorageKey(baseKey, null)).toBe(baseKey);

    window.localStorage.setItem(gabrielKey, JSON.stringify(["job-for-gabriel"]));
    window.localStorage.setItem(employerKey, JSON.stringify(["job-for-team"]));

    expect(JSON.parse(window.localStorage.getItem(gabrielKey) ?? "[]")).toEqual(
      ["job-for-gabriel"],
    );
    expect(JSON.parse(window.localStorage.getItem(employerKey) ?? "[]")).toEqual(
      ["job-for-team"],
    );
  });

  it("reloads a new account key without copying the previous value", async () => {
    window.localStorage.setItem("account-a", JSON.stringify(["A"]));
    window.localStorage.setItem("account-b", JSON.stringify(["B"]));

    function Probe({ storageKey }: { storageKey: string }) {
      const [value] = usePersistentState<string[]>(storageKey, []);
      return <output>{value.join(",")}</output>;
    }

    const view = render(<Probe storageKey="account-a" />);
    expect(screen.getByRole("status")).toHaveTextContent("A");

    view.rerender(<Probe storageKey="account-b" />);
    expect(screen.getByRole("status")).toHaveTextContent("B");

    await waitFor(() => {
      expect(
        JSON.parse(window.localStorage.getItem("account-b") ?? "[]"),
      ).toEqual(["B"]);
    });
  });
});

describe("published employer jobs", () => {
  it("makes a valid employer post available through the public job catalog", () => {
    const post = {
      id: "direct-qa-support-1722067200000",
      title: "QA Support Associate",
      employmentType: "Full-time",
      openings: "2",
      deadline: "2026-08-31",
      schedule: "Monday to Friday, 8:00 AM-5:00 PM",
      description:
        "Help the quality team reproduce issues and document clear results.",
      salaryMin: "21000",
      salaryMax: "27000",
      barangay: "Balibago",
      city: "Angeles City",
      province: "Pampanga",
      workSetup: "On-site",
      employerName: "Gabriel Jr. Digital",
      location: "Balibago, Angeles City, Pampanga",
      ownerId: "mock-team@example.com",
      skills: ["Quality assurance", "Documentation", "Troubleshooting"],
      publishedAt: "2026-07-27T09:00:00+08:00",
    };
    window.localStorage.setItem(
      EMPLOYER_PUBLISHED_POSTS_STORAGE_KEY,
      JSON.stringify([post]),
    );

    const jobs = getAllJobs();
    const publishedJob = jobs.find((job) => job.id === post.id);

    expect(publishedJob).toMatchObject({
      id: post.id,
      title: "QA Support Associate",
      employerName: "Gabriel Jr. Digital",
      employmentType: "Full-time",
      workArrangement: "On-site",
      location: {
        barangay: "Balibago",
        city: "Angeles City",
        province: "Pampanga",
      },
      source: {
        origin: "direct-employer",
        applicationMethod: "jobfinder",
      },
    });
    expect(publishedJob?.requirements.requiredSkills).toEqual(post.skills);
    expect(jobs[0]?.id).toBe(post.id);
  });
});

describe("employer application inbox", () => {
  it("counts only the signed-in employer inbox on dashboard and posts", async () => {
    const employerId = "mock-team@example.com";
    const otherEmployerId = "mock-other-team@example.com";
    const post = {
      id: "direct-qa-support-1722067200000",
      title: "QA Support Associate",
      employmentType: "Full-time",
      openings: "2",
      deadline: "2026-08-31",
      schedule: "Monday to Friday, 8:00 AM-5:00 PM",
      description:
        "Help the quality team reproduce issues and document clear results.",
      salaryMin: "21000",
      salaryMax: "27000",
      barangay: "Balibago",
      city: "Angeles City",
      province: "Pampanga",
      workSetup: "On-site",
      employerName: "Gabriel Jr. Digital",
      location: "Balibago, Angeles City, Pampanga",
      ownerId: employerId,
      skills: ["Quality assurance", "Documentation", "Troubleshooting"],
      publishedAt: "2026-07-27T09:00:00+08:00",
    };
    const application: StoredSubmittedApplication = {
      version: 1,
      id: "application-count-1",
      jobId: post.id,
      jobTitle: post.title,
      employerName: post.employerName,
      location: post.location,
      applicantAccountId: "mock-counted-applicant@example.com",
      recipientEmployerId: employerId,
      appliedAt: "2026-07-27T10:15:00+08:00",
      status: "Submitted",
      applicant: {
        fullName: "Counted Applicant",
        email: "counted.applicant@example.com",
        mobile: "09171234567",
      },
      resume: {
        name: "counted-applicant-resume.pdf",
        sizeBytes: 128_000,
        type: "application/pdf",
      },
      message: "Please review my application.",
    };
    const otherEmployerApplication: StoredSubmittedApplication = {
      ...application,
      id: "application-other-employer",
      applicantAccountId: "mock-other-applicant@example.com",
      recipientEmployerId: otherEmployerId,
      applicant: {
        ...application.applicant,
        fullName: "Other Applicant",
        email: "other.applicant@example.com",
      },
    };

    window.localStorage.setItem(
      EMPLOYER_PUBLISHED_POSTS_STORAGE_KEY,
      JSON.stringify([post]),
    );
    window.localStorage.setItem(
      userStorageKey(EMPLOYER_APPLICATION_INBOX_STORAGE_KEY, employerId),
      JSON.stringify([application]),
    );
    window.localStorage.setItem(
      userStorageKey(
        EMPLOYER_APPLICATION_INBOX_STORAGE_KEY,
        otherEmployerId,
      ),
      JSON.stringify([otherEmployerApplication]),
    );
    window.localStorage.setItem(
      AUTH_USER_STORAGE_KEY,
      JSON.stringify({
        id: employerId,
        email: employerId,
        displayName: "Gabriel Jr. Team",
        role: "employer",
      }),
    );

    const dashboard = render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/employer"]}>
          <EmployerPage />
        </MemoryRouter>
      </AuthProvider>,
    );

    const dashboardPost = within(
      await screen.findByRole("region", {
        name: "Employer job posts",
      }),
    ).getByText(post.title);
    const dashboardRow = dashboardPost.closest("tr");
    expect(dashboardRow).not.toBeNull();
    expect(
      dashboardRow?.querySelector('td[data-label="Applicants"] strong'),
    ).toHaveTextContent("1");

    dashboard.unmount();

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/employer/posts"]}>
          <EmployerPostsPage />
        </MemoryRouter>
      </AuthProvider>,
    );

    const managedPost = await screen.findByText(post.title);
    const managedPostRow = managedPost.closest("tr");
    expect(managedPostRow).not.toBeNull();
    expect(
      managedPostRow?.querySelector('td[data-label="Applicants"]'),
    ).toHaveTextContent(/^1$/);
  });

  it("shows a submitted JobFinder application in the matching workflow", async () => {
    const user = userEvent.setup();
    const application: StoredSubmittedApplication = {
      version: 1,
      id: "application-inbox-1",
      jobId: "it-support-assistant-lumina-tech",
      jobTitle: "IT Support Assistant",
      employerName: "Lumina Tech Solutions",
      location: "Sto. Rosario, Angeles City",
      applicantAccountId: "mock-inbox.applicant@example.com",
      recipientEmployerId: "mock-employer@luminatech.example",
      appliedAt: "2026-07-27T10:15:00+08:00",
      status: "Submitted",
      applicant: {
        fullName: "Inbox Applicant",
        email: "inbox.applicant@example.com",
        mobile: "09171234567",
      },
      resume: {
        name: "inbox-applicant-resume.pdf",
        sizeBytes: 128_000,
        type: "application/pdf",
      },
      message: "I can contribute hands-on troubleshooting experience.",
    };
    window.localStorage.setItem(
      userStorageKey(
        EMPLOYER_APPLICATION_INBOX_STORAGE_KEY,
        application.recipientEmployerId,
      ),
      JSON.stringify([application]),
    );
    window.localStorage.setItem(
      AUTH_USER_STORAGE_KEY,
      JSON.stringify({
        id: "mock-employer@luminatech.example",
        email: "employer-test@example.com",
        displayName: "Gabriel Jr. Team",
        role: "employer",
      }),
    );

    render(
      <AuthProvider>
        <MemoryRouter
          initialEntries={[
            "/employer/posts/it-support-assistant-lumina-tech/candidates",
          ]}
        >
          <Routes>
            <Route
              path="/employer/posts/:postId/candidates"
              element={<CandidateMatchesPage />}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    const candidateHeading = await screen.findByRole("heading", {
      name: "Inbox Applicant",
    });
    const candidateCard = candidateHeading.closest("article");
    expect(candidateCard).not.toBeNull();

    await user.click(
      within(candidateCard as HTMLElement).getByRole("button", {
        name: "View Application",
      }),
    );

    expect(
      within(candidateCard as HTMLElement).getByRole("link", {
        name: "inbox.applicant@example.com",
      }),
    ).toHaveAttribute("href", "mailto:inbox.applicant@example.com");
    expect(candidateCard).toHaveTextContent("inbox-applicant-resume.pdf");
    expect(candidateCard).toHaveTextContent(
      "I can contribute hands-on troubleshooting experience.",
    );
  });

  it("maps an employer review update into the applicant account status", async () => {
    const user = userEvent.setup();
    const application: StoredSubmittedApplication = {
      version: 1,
      id: "application-review-sync-1",
      jobId: "it-support-assistant-lumina-tech",
      jobTitle: "IT Support Assistant",
      employerName: "Lumina Tech Solutions",
      location: "Sto. Rosario, Angeles City",
      applicantAccountId: "mock-review.applicant@example.com",
      recipientEmployerId: "mock-employer@luminatech.example",
      appliedAt: "2026-07-27T10:15:00+08:00",
      status: "Submitted",
      applicant: {
        fullName: "Review Sync Applicant",
        email: "review.applicant@example.com",
        mobile: "09171234567",
      },
      resume: {
        name: "review-sync-resume.pdf",
        sizeBytes: 128_000,
        type: "application/pdf",
      },
      message: "Please review my application.",
    };
    window.localStorage.setItem(
      userStorageKey(
        EMPLOYER_APPLICATION_INBOX_STORAGE_KEY,
        application.recipientEmployerId,
      ),
      JSON.stringify([application]),
    );
    window.localStorage.setItem(
      AUTH_USER_STORAGE_KEY,
      JSON.stringify({
        id: application.recipientEmployerId,
        email: "employer-test@example.com",
        displayName: "Gabriel Jr. Team",
        role: "employer",
      }),
    );

    render(
      <AuthProvider>
        <MemoryRouter
          initialEntries={[
            "/employer/posts/it-support-assistant-lumina-tech/candidates",
          ]}
        >
          <Routes>
            <Route
              path="/employer/posts/:postId/candidates"
              element={<CandidateMatchesPage />}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    const candidateHeading = await screen.findByRole("heading", {
      name: application.applicant.fullName,
    });
    const candidateCard = candidateHeading.closest("article");
    expect(candidateCard).not.toBeNull();

    await user.selectOptions(
      within(candidateCard as HTMLElement).getByRole("combobox", {
        name: "Review status",
      }),
      "Reviewing",
    );

    await waitFor(() => {
      const savedStatus =
        readApplicationReviewStatuses(application.applicantAccountId)[
          application.id
        ];
      expect(savedStatus).toMatchObject({
        applicationId: application.id,
        jobId: application.jobId,
        applicantAccountId: application.applicantAccountId,
        recipientEmployerId: application.recipientEmployerId,
        status: "Reviewing",
      });
      expect(toApplicantApplicationStatus(savedStatus.status)).toBe(
        "Under review",
      );
    });
    expect(
      readApplicationReviewStatuses("mock-unrelated-applicant@example.com"),
    ).toEqual({});
  });
});

describe("employer deep-link sanitization", () => {
  it.each([
    "/employer",
    "/employer/posts",
    "/employer/posts/new",
    "/employer/candidates?job=direct-qa-support#matches",
    "/employer/posts/direct-qa-support/candidates",
    "/employer/company",
  ])("preserves the allowed employer target %s", (target) => {
    expect(sanitizeEmployerReturnTo(target)).toBe(target);
  });

  it.each([
    "https://malicious.example/employer",
    "//malicious.example/employer",
    "/\\malicious.example",
    "/employer/../admin",
    "/employer/%2e%2e/admin",
    "/employer/posts/direct%2Fadmin/candidates",
    "/jobs",
    "/admin",
    "javascript:alert(1)",
  ])("falls back for an unsafe or unrelated target %s", (target) => {
    expect(sanitizeEmployerReturnTo(target)).toBe("/employer");
  });
});
