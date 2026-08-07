import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JOBS } from "./data";
import { JobCard } from "./JobCard";

afterEach(cleanup);

describe("JobCard", () => {
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
