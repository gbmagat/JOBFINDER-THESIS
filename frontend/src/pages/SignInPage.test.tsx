import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AUTH_INTENT_STORAGE_KEY } from "../features/auth/auth-intent";

const auth = vi.hoisted(() => ({
  isAuthenticated: false as boolean,
  signIn: vi.fn(),
  user: null as null | {
    id: string;
    email: string;
    displayName: string;
    role: "job-seeker" | "employer" | "peso-lgu";
  },
}));

const jobs = vi.hoisted(() => ({
  getJob: vi.fn(
    (): null | { id: string; title: string; employerName: string } => null,
  ),
}));

vi.mock("../features/auth/AuthContext", () => ({
  useAuth: () => auth,
}));

vi.mock("../features/jobs/JobsContext", () => ({
  useJobs: () => jobs,
}));

vi.mock("../lib/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
}));

import { SignInPage } from "./SignInPage";

afterEach(() => {
  cleanup();
  auth.isAuthenticated = false;
  auth.signIn.mockReset();
  auth.user = null;
  jobs.getJob.mockReset();
  jobs.getJob.mockReturnValue(null);
  window.sessionStorage.clear();
});

function renderSignIn(path = "/sign-in") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/jobs" element={<h1>Job Seeker Workspace Ready</h1>} />
        <Route path="/employer" element={<h1>Employer Workspace Ready</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submitCredentials() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email Address"), "user@example.com");
  await user.type(screen.getByLabelText("Password"), "password123");
  await user.click(screen.getByRole("button", { name: "Sign In" }));
}

describe("generic account sign in", () => {
  it("accepts an Employer account and opens the Employer Workspace", async () => {
    auth.signIn.mockResolvedValue({
      id: "employer-user",
      email: "user@example.com",
      displayName: "Employer User",
      role: "employer",
    });
    renderSignIn();

    await submitCredentials();

    expect(
      await screen.findByRole("heading", { name: "Employer Workspace Ready" }),
    ).toBeInTheDocument();
    expect(auth.signIn).toHaveBeenCalledWith(
      {
        email: "user@example.com",
        password: "password123",
        role: undefined,
      },
      ["job-seeker", "employer"],
    );
  });

  it("accepts a Job Seeker account and opens local jobs", async () => {
    auth.signIn.mockResolvedValue({
      id: "job-seeker-user",
      email: "user@example.com",
      displayName: "Job Seeker User",
      role: "job-seeker",
    });
    renderSignIn();

    await submitCredentials();

    expect(
      await screen.findByRole("heading", {
        name: "Job Seeker Workspace Ready",
      }),
    ).toBeInTheDocument();
  });

  it("keeps an explicit Job Seeker sign-in role restricted", async () => {
    auth.signIn.mockRejectedValue(
      new Error("This email belongs to an Employer account."),
    );
    renderSignIn("/sign-in?role=job-seeker&returnTo=%2Fjobs");

    await submitCredentials();

    expect(
      await screen.findByText("This email belongs to an Employer account."),
    ).toBeInTheDocument();
    expect(auth.signIn).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
      role: "job-seeker",
    });
  });

  it("redirects an already authenticated Employer to the Employer Workspace", async () => {
    auth.isAuthenticated = true;
    auth.user = {
      id: "employer-user",
      email: "user@example.com",
      displayName: "Employer User",
      role: "employer",
    };

    renderSignIn("/sign-in?returnTo=%2Fjobs");

    expect(
      await screen.findByRole("heading", { name: "Employer Workspace Ready" }),
    ).toBeInTheDocument();
  });

  it("does not send an Employer into a saved Job Seeker application", async () => {
    const jobId = "it-support-assistant-lumina-tech";
    jobs.getJob.mockReturnValue({
      id: jobId,
      title: "IT Support Assistant",
      employerName: "Lumina Tech Solutions",
    });
    window.sessionStorage.setItem(
      AUTH_INTENT_STORAGE_KEY,
      JSON.stringify({
        kind: "apply",
        jobId,
        returnTo: `/jobs/${jobId}/apply`,
        createdAt: Date.now(),
      }),
    );
    auth.signIn.mockResolvedValue({
      id: "employer-user",
      email: "user@example.com",
      displayName: "Employer User",
      role: "employer",
    });

    renderSignIn("/sign-in?role=employer&returnTo=%2Femployer");
    await submitCredentials();

    expect(
      await screen.findByRole("heading", { name: "Employer Workspace Ready" }),
    ).toBeInTheDocument();
    expect(window.sessionStorage.getItem(AUTH_INTENT_STORAGE_KEY)).toBeNull();
    expect(auth.signIn).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
      role: "employer",
    });
  });
});
