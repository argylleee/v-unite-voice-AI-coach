import { expect, test } from "@playwright/test";

// Phase 1 smoke test: the deployed foundation actually serves a page. The full core-journey
// e2e (session -> question -> response -> summary) is added in a later phase per docs/TESTING.md.
test("home page renders the app name", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "V-Unite Voice AI Coach" }),
  ).toBeVisible();
});
