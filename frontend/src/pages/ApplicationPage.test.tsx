import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthContext";
import {
  APPLICATION_DRAFTS_STORAGE_KEY,
  SUBMITTED_APPLICATIONS_STORAGE_KEY,
} from "../features/applications/storage-contract";
import { ApplicationPage } from "./ApplicationPage";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function renderApplication(jobId: string) {
  return render(
    <AuthProvider storage={null}>
      <MemoryRouter initialEntries={[`/jobs/${jobId}/apply`]}>
        <Routes>
          <Route path="/jobs/:jobId/apply" element={<ApplicationPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("ApplicationPage", () => {
  it("validates and persists a completed native JobFinder application", async () => {
    const user = userEvent.setup();
    renderApplication("it-support-assistant-lumina-tech");

    await user.click(
      screen.getByRole("button", { name: "Continue" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter your full name",
    );

    await user.type(screen.getByLabelText("Full name"), "Gabriel Magat Jr.");
    await user.type(
      screen.getByLabelText("Email address"),
      "gabriel@example.com",
    );
    await user.type(screen.getByLabelText("Mobile number"), "09171234567");
    await user.click(
      screen.getByRole("button", { name: "Continue" }),
    );

    expect(
      screen.getByRole("heading", { name: "Add Your Resume and Message" }),
    ).toBeInTheDocument();

    const resume = new File(["resume"], "gabriel-resume.pdf", {
      type: "application/pdf",
    });
    await user.upload(screen.getByLabelText(/Choose your resume/), resume);
    await user.type(
      screen.getByLabelText("Message to employer"),
      "I would welcome the opportunity to contribute my support skills.",
    );
    await user.click(
      screen.getByRole("button", { name: "Review Application" }),
    );

    expect(
      screen.getByRole("heading", { name: "Review Application" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: "Submit Application" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Your Application Was Sent to Lumina Tech Solutions",
      }),
    ).toBeInTheDocument();

    const stored = JSON.parse(
      window.localStorage.getItem(SUBMITTED_APPLICATIONS_STORAGE_KEY) ?? "[]",
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      version: 1,
      jobId: "it-support-assistant-lumina-tech",
      status: "Submitted",
      applicant: {
        fullName: "Gabriel Magat Jr.",
        email: "gabriel@example.com",
        mobile: "09171234567",
      },
      resume: { name: "gabriel-resume.pdf" },
    });
  });

  it("saves an incomplete application draft per job", async () => {
    const user = userEvent.setup();
    renderApplication("it-support-assistant-lumina-tech");

    await user.type(screen.getByLabelText("Full name"), "Gabriel Magat Jr.");
    await user.click(screen.getByRole("button", { name: "Save Draft" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Draft saved on this device",
    );
    const stored = JSON.parse(
      window.localStorage.getItem(APPLICATION_DRAFTS_STORAGE_KEY) ?? "{}",
    );
    expect(stored["it-support-assistant-lumina-tech"]).toMatchObject({
      version: 1,
      jobId: "it-support-assistant-lumina-tech",
      fullName: "Gabriel Magat Jr.",
    });
  });

  it("preserves an imported listing's source-specific email handoff", () => {
    renderApplication("customer-service-associate-clarkconnect");

    const handoff = screen.getByRole("link", {
        name: "Open Email Application",
    });
    expect(handoff).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:applications@clarkconnect.example"),
    );
    expect(
      screen.getByText(/does not replace a PESO\/LGU/i),
    ).toBeInTheDocument();
  });
});
