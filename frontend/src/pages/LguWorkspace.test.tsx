import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthContext";
import type { StorageLike } from "../features/auth/auth-intent";
import {
  LGU_OVERVIEW,
  LGU_VERIFICATION_ITEMS,
} from "../features/lgu/data";
import { LguAuditLogPage } from "./LguAuditLogPage";
import { LguEmployerRecordsPage } from "./LguEmployerRecordsPage";
import { LguEmployerReviewPage } from "./LguEmployerReviewPage";
import { LguJobReviewPage } from "./LguJobReviewPage";
import { LguOverviewPage } from "./LguOverviewPage";
import { LguSignInPage } from "./LguSignInPage";
import { LguVerificationQueuePage } from "./LguVerificationQueuePage";

const lguApi = vi.hoisted(() => ({
  getLguAuditLog: vi.fn(),
  getLguEmployerReview: vi.fn(),
  getLguEmployers: vi.fn(),
  getLguJobReview: vi.fn(),
  getLguOverview: vi.fn(),
  getLguVerificationQueue: vi.fn(),
  submitLguEmployerDecision: vi.fn(),
  submitLguJobDecision: vi.fn(),
}));

vi.mock("../features/lgu/api", () => lguApi);

const employerVerification = {
  status: "pending" as const,
  evidence: [
    { type: "business-registration", status: "complete" },
    { type: "workplace-address", status: "confirmed" },
  ],
  decisionReason: "",
  reviewedBy: null,
  reviewedAt: null,
  updatedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  lguApi.getLguOverview.mockResolvedValue(LGU_OVERVIEW);
  lguApi.getLguVerificationQueue.mockResolvedValue({
    items: LGU_VERIFICATION_ITEMS,
  });
  lguApi.getLguJobReview.mockResolvedValue({
    job: {
      id: "service-crew-northpoint",
      title: "Service Crew",
      employerName: "Northpoint Café",
      summary: "Help customers and prepare orders.",
      description: "Help customers and prepare orders during scheduled shifts.",
      location: { barangay: "Balibago", city: "Angeles City" },
      employmentType: "Full-time",
      workArrangement: "On-site",
      openingCount: 3,
      salary: { minimumPhp: 16000, maximumPhp: 18000 },
      requirements: { requiredSkills: ["Customer Service", "Food Safety"] },
      reviewStatus: "pending",
      reviewReason: "",
    },
    employer: {
      id: "northpoint-cafe",
      companyName: "Northpoint Café",
      verification: employerVerification,
    },
    evidence: employerVerification.evidence,
    status: "pending",
  });
  lguApi.getLguEmployerReview.mockResolvedValue({
    employer: {
      id: "northpoint-cafe",
      email: "hr@northpoint.example",
      displayName: "Maria Reyes",
      companyName: "Northpoint Café",
      description: "Local café",
      address: "Balibago, Angeles City",
      website: "",
      details: {
        industry: "Food and beverage services",
        phone: "0917 555 0182",
      },
      verification: employerVerification,
      activeJobs: 2,
      totalJobs: 3,
    },
    checklist: [
      { id: "business-registration", label: "Business Record", status: "complete" },
      { id: "business-contact", label: "Business Contact", status: "confirmed" },
      { id: "workplace-address", label: "Workplace Address", status: "confirmed" },
    ],
    evidence: employerVerification.evidence,
    jobs: [],
  });
  lguApi.submitLguJobDecision.mockResolvedValue({ status: "approved" });
  lguApi.submitLguEmployerDecision.mockResolvedValue({ status: "verified" });
});

afterEach(cleanup);

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("LGU workspace", () => {
  it.each([
    ["Verification Overview", <LguOverviewPage />],
    ["Job Post Verification", <LguVerificationQueuePage />],
    ["Service Crew", <LguJobReviewPage />],
    ["Employer Records", <LguEmployerRecordsPage />],
    ["Review Employer Record", <LguEmployerReviewPage />],
    ["Audit Log", <LguAuditLogPage />],
  ])("renders the %s screen", async (heading, page) => {
    render(<MemoryRouter>{page}</MemoryRouter>);
    expect(await screen.findByRole("heading", { name: heading, level: 1 })).toBeInTheDocument();
  });

  it("filters the verification queue by employer or barangay", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><LguVerificationQueuePage /></MemoryRouter>);

    await user.type(
      screen.getByRole("searchbox", { name: "Search verification queue" }),
      "Cutcut",
    );

    expect(screen.getByRole("heading", { name: "Warehouse Assistant" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Service Crew" })).not.toBeInTheDocument();
  });

  it("uses the explicit high-risk classification", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><LguVerificationQueuePage /></MemoryRouter>);

    await screen.findByRole("heading", { name: "Warehouse Assistant" });
    await user.click(screen.getByRole("button", { name: "High Risk" }));

    expect(screen.getByRole("heading", { name: "Warehouse Assistant" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Service Crew" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Front Desk Associate" })).not.toBeInTheDocument();
  });

  it("disables Review Next when the queue is empty", async () => {
    lguApi.getLguVerificationQueue.mockResolvedValueOnce({ items: [] });
    render(<MemoryRouter><LguVerificationQueuePage /></MemoryRouter>);

    expect(
      await screen.findByRole("button", { name: "Review Next" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("link", { name: "Review Next" }),
    ).not.toBeInTheDocument();
  });

  it("records a job review decision in the visible page state", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><LguJobReviewPage /></MemoryRouter>);

    await user.click(await screen.findByRole("button", { name: "Approve Job Post" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Job post approved and ready to publish.",
    );
  });

  it("renders and decides on the job identified by the route", async () => {
    lguApi.getLguJobReview.mockResolvedValueOnce({
      ...(await lguApi.getLguJobReview()),
      job: {
        ...(await lguApi.getLguJobReview()).job,
        id: "warehouse-role-2",
        title: "Warehouse Assistant",
      },
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/lgu/verification/jobs/warehouse-role-2"]}>
        <Routes>
          <Route
            path="/lgu/verification/jobs/:jobId"
            element={<LguJobReviewPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Warehouse Assistant", level: 1 }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Approve Job Post" }));
    expect(lguApi.submitLguJobDecision).toHaveBeenCalledWith(
      "warehouse-role-2",
      { decision: "approve", note: "" },
    );
  });

  it("renders and decides on the employer identified by the route", async () => {
    const defaultReview = await lguApi.getLguEmployerReview();
    lguApi.getLguEmployerReview.mockResolvedValueOnce({
      ...defaultReview,
      employer: {
        ...defaultReview.employer,
        id: "hotel-nueve",
        companyName: "Hotel Nueve",
      },
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/lgu/employers/hotel-nueve"]}>
        <Routes>
          <Route
            path="/lgu/employers/:employerId"
            element={<LguEmployerReviewPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Hotel Nueve", level: 2 }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Verify Employer" }));
    expect(lguApi.submitLguEmployerDecision).toHaveBeenCalledWith(
      "hotel-nueve",
      { decision: "approve", note: "" },
    );
  });

  it("signs in through the restricted reviewer form without registration", async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider storage={new MemoryStorage()}>
        <MemoryRouter initialEntries={["/lgu/sign-in?returnTo=%2Flgu"]}>
          <Routes>
            <Route path="/lgu/sign-in" element={<LguSignInPage />} />
            <Route path="/lgu" element={<h1>LGU Workspace Ready</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    await user.type(screen.getByLabelText("Official Email Address"), "reviewer@lgu.gov.ph");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign In to LGU Workspace" }));

    expect(await screen.findByRole("heading", { name: "LGU Workspace Ready" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /register/i })).not.toBeInTheDocument();
  });
});
