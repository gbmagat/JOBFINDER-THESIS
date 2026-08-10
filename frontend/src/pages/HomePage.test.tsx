import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import {
  AUTH_USER_STORAGE_KEY,
  AuthProvider,
} from "../features/auth/AuthContext";
import {
  PROFILE_DETAILS_KEY,
  PROFILE_SKILLS_KEY,
  WORK_TYPES_KEY,
} from "../features/profile/storage";
import { userStorageKey } from "../lib/storage-keys";
import { HomePage } from "./HomePage";

vi.mock("../features/jobs/JobCard", () => ({
  JobCard: ({
    job,
    showMatchEvidence,
  }: {
    job: { fit: { overallScore: number }; title: string };
    showMatchEvidence?: boolean;
  }) => (
    <div
      data-match-evidence={String(Boolean(showMatchEvidence))}
      data-score={job.fit.overallScore}
      data-testid="home-job-card"
    >
      {job.title}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function renderGuestHome() {
  return render(
    <AuthProvider storage={null}>
      <MemoryRouter initialEntries={["/"]}>
        <HomePage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("HomePage guest experience", () => {
  it("shows the local public job gateway without match data", () => {
    const { container } = renderGuestHome();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Find your next opportunity.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Featured Jobs for You" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Local Insights" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Browse by Category" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Get discovered" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Customer Service Associate" }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "IT Support Assistant" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Junior Web Developer" }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("article.public-job-card")).toHaveLength(4);
    expect(
      screen.getAllByRole("link", { name: /View details for/i }),
    ).toHaveLength(4);
    expect(
      screen.queryByLabelText(/percent overall match/i),
    ).not.toBeInTheDocument();
  });
});

describe("HomePage job seeker state", () => {
  it("starts a new account with profile setup guidance", () => {
    window.localStorage.setItem(
      AUTH_USER_STORAGE_KEY,
      JSON.stringify({
        id: "new-job-seeker",
        email: "new@example.com",
        displayName: "New Job Seeker",
        role: "job-seeker",
      }),
    );

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <HomePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("region", { name: "Job seeker summary" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Local jobs" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Set up your profile" }),
    ).toHaveAttribute("href", "/onboarding/profile");
    expect(screen.queryByText(/\d+% match/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/commute limit|travel limit|minutes/i),
    ).not.toBeInTheDocument();
  });

  it("unlocks matches with profile details and skills but no travel limits", () => {
    const user = {
      id: "complete-job-seeker",
      email: "complete@example.com",
      displayName: "Complete Job Seeker",
      role: "job-seeker",
    };
    window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    window.localStorage.setItem(
      userStorageKey(PROFILE_DETAILS_KEY, user.id),
      JSON.stringify({
        fullName: "Complete Job Seeker",
        mobileNumber: "09171234567",
        barangay: "Balibago",
        city: "Angeles City",
      }),
    );
    window.localStorage.setItem(
      userStorageKey(PROFILE_SKILLS_KEY, user.id),
      JSON.stringify(["Troubleshooting"]),
    );
    window.localStorage.setItem(
      userStorageKey(WORK_TYPES_KEY, user.id),
      JSON.stringify(["On-site"]),
    );

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <HomePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Top matches" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Jobs for Complete" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Balibago, Angeles City").length).toBeGreaterThan(0);
    expect(screen.getByText("On-site")).toBeInTheDocument();
    expect(screen.getByText("Troubleshooting")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Your profile" }),
    ).toBeInTheDocument();
    const recommendedCards = screen.getAllByTestId("home-job-card");
    const scores = recommendedCards.map((card) => Number(card.dataset.score));
    expect(scores).toEqual([...scores].sort((first, second) => second - first));
    expect(
      recommendedCards.every(
        (card) => card.dataset.matchEvidence === "true",
      ),
    ).toBe(true);
    expect(screen.queryByText(/Good Morning/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Personalized ranking")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/commute limit|travel limit|minutes/i),
    ).not.toBeInTheDocument();
  });
});
