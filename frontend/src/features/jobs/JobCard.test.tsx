import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JOBS, jobSourceLabel } from "./data";
import { JobCard } from "./JobCard";

afterEach(cleanup);

describe("JobCard", () => {
  it("shows concrete skill evidence for a personalized recommendation", () => {
    render(
      <MemoryRouter>
        <JobCard job={JOBS[0]} showMatch showMatchEvidence />
      </MemoryRouter>,
    );

    expect(screen.getByText("Matches:")).toBeInTheDocument();
    expect(
      screen.getByText("Computer troubleshooting, Customer support"),
    ).toBeInTheDocument();
  });

  it("can omit repeated source and summary text on compact cards", () => {
    render(
      <MemoryRouter>
        <JobCard job={JOBS[0]} showSource={false} showSummary={false} />
      </MemoryRouter>,
    );

    expect(
      screen.queryByText(jobSourceLabel(JOBS[0].source)),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(JOBS[0].summary)).not.toBeInTheDocument();
  });

  it("uses the card surface for map selection without visible map-action text", () => {
    const onShowOnMap = vi.fn();

    render(
      <MemoryRouter>
        <JobCard
          isShownOnMap
          job={JOBS[0]}
          onShowOnMap={onShowOnMap}
          showDistanceFact
          showSummary={false}
        />
      </MemoryRouter>,
    );

    const selectionButton = screen.getByRole("button", {
      name: "Deselect IT Support Assistant and show all jobs on map",
    });
    expect(selectionButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/Show(?:ing)? on Map/i)).not.toBeInTheDocument();

    fireEvent.click(selectionButton);
    expect(onShowOnMap).toHaveBeenCalledTimes(1);

    const titleLink = screen.getByRole("link", {
      name: "IT Support Assistant",
    });
    const detailsLink = screen.getByRole("link", {
      name: "View details for IT Support Assistant at Lumina Tech Solutions",
    });
    expect(titleLink).toHaveAttribute(
      "href",
      "/jobs/it-support-assistant-lumina-tech",
    );
    expect(detailsLink).toHaveAttribute(
      "href",
      "/jobs/it-support-assistant-lumina-tech",
    );

    fireEvent.click(detailsLink);
    expect(onShowOnMap).toHaveBeenCalledTimes(1);
  });
});
