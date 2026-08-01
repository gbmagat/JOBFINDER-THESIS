import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import {
  AUTH_USER_STORAGE_KEY,
  AuthProvider,
} from "../features/auth/AuthContext";
import {
  PROFILE_DETAILS_KEY,
  PROFILE_SKILLS_KEY,
} from "../features/profile/storage";
import { userStorageKey } from "../lib/storage-keys";
import { HomePage } from "./HomePage";

vi.mock("../features/jobs/JobCard", () => ({ JobCard: () => null }));

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
  it("shows the public gateway without the rejected hero or match data", () => {
    renderGuestHome();

    expect(
      screen.getByRole("heading", { level: 1, name: "Welcome to JobFinder" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Find work closer to home/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Start Exploring JobFinder" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Recently Added Jobs" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByAltText(/colleagues reviewing work/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/No account needed to browse/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/percent overall match/i),
    ).not.toBeInTheDocument();
  });
});

describe("HomePage job seeker state", () => {
  it("starts a new account without saved jobs or applications", () => {
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

    const summary = screen.getByRole("region", {
      name: "Job seeker summary",
    });
    const savedJobs = within(summary)
      .getByText("Saved Jobs")
      .closest(".dashboard-stat");
    const applications = within(summary)
      .getByText("Active Applications")
      .closest(".dashboard-stat");

    expect(savedJobs).toHaveTextContent("0");
    expect(applications).toHaveTextContent("0");
    expect(applications).toHaveTextContent("No active applications yet");
    expect(summary).toHaveTextContent("Complete your profile to see matches");
    expect(
      screen.getByRole("heading", { name: "Explore Local Jobs" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Set Up Your Profile" }),
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

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <HomePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Best Matches" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Personalized ranking")).toBeInTheDocument();
    expect(
      screen.queryByText(/commute limit|travel limit|minutes/i),
    ).not.toBeInTheDocument();
  });
});
