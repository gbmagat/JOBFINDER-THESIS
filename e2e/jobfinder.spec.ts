import { expect, test, type Page } from "@playwright/test";

const jobId = "it-support-assistant-lumina-tech";
const jobTitle = "IT Support Assistant";
const seeker = {
  email: "qa-seeker@example.test",
  password: "qa-test-password-2026",
};
const employer = {
  email: "qa-employer@example.test",
  password: "qa-test-password-2026",
};
const lguReviewer = {
  email: "qa-lgu@example.test",
  password: "qa-test-password-2026",
};
const transparentMapTile = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function useOfflineOpenStreetMapTiles(page: Page) {
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      body: transparentMapTile,
      contentType: "image/png",
      status: 200,
    }),
  );
}

function expectDijkstraGeometry(payload: {
  route: {
    algorithm?: string;
    geometry: { coordinates: number[][]; type: string };
    routeId: string;
  };
}) {
  expect(payload.route.algorithm).toBe("dijkstra");
  expect(payload.route.geometry.type).toBe("LineString");
  expect(payload.route.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
  for (const [longitude, latitude] of payload.route.geometry.coordinates) {
    expect(Number.isFinite(longitude)).toBe(true);
    expect(Number.isFinite(latitude)).toBe(true);
    expect(Math.abs(longitude)).toBeLessThanOrEqual(180);
    expect(Math.abs(latitude)).toBeLessThanOrEqual(90);
  }
}

async function signIn(
  page: Page,
  account: typeof seeker,
  role: "job-seeker" | "employer",
) {
  const returnTo = role === "employer" ? "/employer" : "/profile";
  const query = new URLSearchParams({
    returnTo,
    ...(role === "employer" ? { role: "employer" } : {}),
  });
  await page.goto(`/sign-in?${query.toString()}`);
  await page.getByLabel("Email Address").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${returnTo.replace("/", "\\/")}$`));
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <= window.innerWidth &&
          document.body.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
}

test.describe.serial("JobFinder critical user journeys", () => {
  test("a guest can browse jobs but sees no personal match score", async ({
    page,
  }) => {
    await page.goto("/jobs");

    await expect(
      page.getByRole("heading", { name: "Search Local Jobs" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "3 Jobs Found" })).toBeVisible();
    await expect(page.getByText(/\d+% match/i)).toHaveCount(0);
    await expect(page.getByText(/\b\d+\s*(?:min|minute|minutes)\b/i)).toHaveCount(0);
    await expect(page.getByText(/Maximum travel time/i)).toHaveCount(0);
    await expect(page.locator(".job-card")).toHaveCount(3);
    await expect(
      page.locator(".job-card").getByText(/\b\d+(?:\.\d+)?\s*km away\b/i),
    ).toHaveCount(3);

    await page.getByRole("link", { name: jobTitle }).first().click();
    await expect(page.getByRole("heading", { name: jobTitle })).toBeVisible();
    await expect(page.getByText(/\d+% overall match/i)).toHaveCount(0);
    await expect(page.getByText(/\b\d+\s*(?:min|minute|minutes)\b/i)).toHaveCount(0);

    await page.getByRole("button", { name: "Sign In to Apply" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Keep Your Application Connected",
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue Browsing" }).click();

    await page.goto("/profile");
    await expect(page).toHaveURL(/\/sign-in\?.*returnTo=%2Fprofile/);
  });

  test("the jobs and route maps show OSM data with JobFinder Dijkstra geometry", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await useOfflineOpenStreetMapTiles(page);

    const jobsRouteResponsePromise = page.waitForResponse(
      (response) =>
        /\/api\/jobs\/[^/]+\/route$/.test(new URL(response.url()).pathname) &&
        response.request().method() === "GET",
    );
    await page.goto("/jobs");
    const jobsRouteResponse = await jobsRouteResponsePromise;
    expect(jobsRouteResponse.ok()).toBe(true);
    const jobsRoutePayload = (await jobsRouteResponse.json()) as {
      route: {
        algorithm?: string;
        geometry: { coordinates: number[][]; type: string };
        routeId: string;
      };
    };
    expectDijkstraGeometry(jobsRoutePayload);

    const jobsMap = page.getByTestId("jobs-map");
    await expect(jobsMap).toBeVisible();
    await expect(jobsMap).toHaveAttribute("data-marker-count", "3");
    await expect(jobsMap).toHaveAttribute(
      "data-route-id",
      jobsRoutePayload.route.routeId,
    );
    await expect(
      jobsMap.getByRole("link", { name: "OpenStreetMap" }),
    ).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/copyright",
    );
    await expect(
      page.getByText("Shortest path calculated by JobFinder Dijkstra"),
    ).toBeVisible();

    const routeResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/jobs/${jobId}/route` &&
        response.request().method() === "GET",
    );
    await page.goto(`/jobs/${jobId}/route`);
    const routeResponse = await routeResponsePromise;
    expect(routeResponse.ok()).toBe(true);
    const routePayload = (await routeResponse.json()) as {
      route: {
        algorithm?: string;
        geometry: { coordinates: number[][]; type: string };
        routeId: string;
      };
    };
    expectDijkstraGeometry(routePayload);

    const routeMap = page.getByTestId("route-map");
    await expect(routeMap).toBeVisible();
    await expect(routeMap).toHaveAttribute(
      "data-route-id",
      routePayload.route.routeId,
    );
    await expect(routeMap).toContainText(
      `contains ${routePayload.route.geometry.coordinates.length} mapped points`,
    );
    await expect(
      routeMap.getByRole("link", { name: "OpenStreetMap" }),
    ).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/copyright",
    );
    await expect(
      page.getByText("Calculated by JobFinder Dijkstra", { exact: true }),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/jobs");
    for (let pass = 0; pass < 3; pass += 1) {
      await page.getByRole("button", { name: "Show Map" }).click();
      await expect(page.getByTestId("jobs-map")).toBeVisible();
      await page.getByRole("button", { name: "Show List" }).click();
      await expect(page.getByTestId("jobs-map")).toBeHidden();
    }
    await page.goto(`/jobs/${jobId}/route`);
    await expect(page.getByTestId("route-map")).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("a job seeker signs in through the apply gate and submits a PDF", async ({
    page,
  }) => {
    await page.goto(`/jobs/${jobId}`);
    await page.getByRole("button", { name: "Sign In to Apply" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Email address").fill(seeker.email);
    await dialog.getByLabel("Password").fill(seeker.password);
    await dialog
      .getByRole("button", { name: "Sign In and Continue" })
      .click();

    await expect(page).toHaveURL(new RegExp(`/jobs/${jobId}/apply$`));
    await page.getByLabel("Full name").fill("JobFinder Demo User");
    await page.getByLabel("Email address").fill(seeker.email);
    await page.getByLabel("Mobile number").fill("0917 123 4567");
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await page.locator('input[type="file"]').setInputFiles({
      name: "qa-resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF"),
    });
    await page
      .getByLabel("Message to employer")
      .fill("I am interested in this role and can support local users.");
    await page.getByRole("button", { name: "Review Application" }).click();
    await page
      .getByLabel(/I confirm that these details are accurate/i)
      .check();
    await page.getByRole("button", { name: "Submit Application" }).click();

    await expect(
      page.getByRole("heading", {
        name: /Your Application Was Sent to Lumina Tech Solutions/i,
      }),
    ).toBeVisible();

    await page.goto("/applications");
    await expect(page.getByRole("heading", { name: "Applications" })).toBeVisible();
    await expect(page.getByText(jobTitle).first()).toBeVisible();
    await expect(page.getByText("Submitted").first()).toBeVisible();
  });

  test("an employer publishes a job and shortlists the submitted applicant", async ({
    page,
  }) => {
    await signIn(page, employer, "employer");
    await page.goto("/employer/posts/new");

    const futureDeadline = new Date();
    futureDeadline.setUTCDate(futureDeadline.getUTCDate() + 30);
    const deadline = futureDeadline.toISOString().slice(0, 10);

    await page.getByLabel("Job title").fill("QA Support Coordinator");
    await page
      .getByLabel("Job description")
      .fill("Coordinate technical support requests and document clear solutions.");
    await page.getByText("Additional Job Details").click();
    await page.getByLabel("Application deadline").fill(deadline);
    await page.getByLabel("Work schedule").fill("Monday to Friday, day shift");
    await page.getByLabel("Minimum pay (PHP)").fill("22000");
    await page.getByLabel("Maximum pay (PHP)").fill("28000");
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await page.getByLabel("Add a required skill").fill("Technical support");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByLabel("Barangay").fill("Sto. Rosario");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByLabel(/I confirm this is an active vacancy owned by our company/i)
      .check();
    await page.getByRole("button", { name: "Publish Job" }).click();

    await expect(
      page.getByRole("heading", { name: "Your Job Post Is Ready" }),
    ).toBeVisible();
    await expect(page.getByText("QA Support Coordinator").first()).toBeVisible();

    await page.goto(`/employer/posts/${jobId}/candidates`);
    const candidate = page
      .locator("article.candidate-card")
      .filter({ hasText: "JobFinder Demo User" });
    await expect(candidate).toBeVisible();
    await candidate
      .getByText("View Why This Applicant Matches", { exact: true })
      .click();
    await candidate.getByLabel("Review status").selectOption("Shortlisted");
    await expect(page.getByText(/Status saved as Shortlisted/i)).toBeVisible();
    await expect(candidate.getByText("Shortlisted").first()).toBeVisible();

    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/auth/logout") &&
          response.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Sign out" }).click(),
    ]);
    await signIn(page, seeker, "job-seeker");
    await page.goto("/applications");
    await expect(page.getByText("Shortlisted").first()).toBeVisible();
  });

  test("an LGU reviewer approves the pending employer job", async ({ page }) => {
    await page.goto("/lgu/sign-in");
    await page.getByLabel("Official Email Address").fill(lguReviewer.email);
    await page.getByLabel("Password", { exact: true }).fill(lguReviewer.password);
    await page
      .getByRole("button", { name: "Sign In to LGU Workspace" })
      .click();
    await expect(page).toHaveURL(/\/lgu$/);
    await expect(
      page.getByRole("heading", { name: "Verification Overview" }),
    ).toBeVisible();

    await page.goto("/lgu/verification");
    const pendingJob = page
      .locator("article.lgu-queue-row")
      .filter({ hasText: "QA Support Coordinator" });
    await expect(pendingJob).toBeVisible();
    await pendingJob.getByRole("link", { name: "Open Review" }).click();
    await expect(
      page.getByRole("heading", { name: "QA Support Coordinator" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Approve Job Post" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Job post approved and ready to publish.",
    );

    await page.goto("/lgu/audit-log");
    await expect(page.getByText("Approved job post").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("an LGU reviewer stays signed in when secure logout fails", async ({
    page,
  }) => {
    await page.goto("/lgu/sign-in");
    await page.getByLabel("Official Email Address").fill(lguReviewer.email);
    await page.getByLabel("Password", { exact: true }).fill(lguReviewer.password);
    await page
      .getByRole("button", { name: "Sign In to LGU Workspace" })
      .click();
    await expect(page).toHaveURL(/\/lgu$/);

    await page.route("**/api/auth/logout", (route) => route.abort());
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "We could not securely sign you out",
    );
    await expect(page).toHaveURL(/\/lgu$/);
    await expect(
      page.getByRole("heading", { name: "Verification Overview" }),
    ).toBeVisible();

    await page.unroute("**/api/auth/logout");
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/auth/logout") &&
          response.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Sign out" }).click(),
    ]);
    await expect(page).toHaveURL(/\/lgu\/sign-in(?:\?.*)?$/);
  });

  test("the authenticated mobile layout has one navigation and can sign out", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, seeker, "job-seeker");

    await expect(page.locator(".mobile-header")).toBeVisible();
    await expect(page.locator('[aria-label="Primary navigation"]:visible')).toHaveCount(1);
    await expectNoHorizontalOverflow(page);

    await page.goto("/onboarding/profile");
    await expect(
      page.getByLabel(/Maximum distance|Maximum travel time|Maximum commute/i),
    ).toHaveCount(0);
    await expect(page.getByText(/\b\d+\s*(?:min|minute|minutes)\b/i)).toHaveCount(0);

    await page.goto("/preferences");
    await expect(page.getByText(/Maximum commute|Travel limit/i)).toHaveCount(0);
    await expect(page.getByText(/\b\d+\s*(?:min|minute|minutes)\b/i)).toHaveCount(0);

    const footer = page.locator("footer").last();
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();

    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/auth/logout") &&
          response.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Sign out" }).click(),
    ]);
    await expect(page).toHaveURL(/\/sign-in(?:\?.*)?$/);
    await expect(
      page.getByRole("heading", { name: "Welcome Back" }),
    ).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/sign-in(?:\?.*)?$/);
    await expect(
      page.getByRole("heading", { name: "Welcome Back" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
