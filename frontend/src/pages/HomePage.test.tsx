import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import {
  AUTH_USER_STORAGE_KEY,
  AuthProvider,
} from "../features/auth/AuthContext";
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
  });
});
