import { test, expect } from "@playwright/test";

// Runs with or without Supabase configured: signed-out behaviour only.
test("landing page loads and links to sign-up", async ({ page }) => {
  await page.goto("/");
  // Without Supabase env vars the proxy sends visitors to /setup; with them, the landing page shows.
  if (page.url().endsWith("/setup")) {
    await expect(page.getByRole("heading").first()).toBeVisible();
    return;
  }
  await expect(page.getByRole("link", { name: /get started|sign up|create/i }).first()).toBeVisible();
});

test("protected pages redirect signed-out visitors", async ({ page }) => {
  for (const path of ["/dashboard", "/insights", "/foods", "/profile"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/(sign-in|setup)/);
  }
});

test("API refuses signed-out requests with JSON", async ({ request }) => {
  const res = await request.get("/api/profile");
  expect([401, 503]).toContain(res.status());
  expect((await res.json()).error.code).toMatch(/unauthenticated|not_configured/);
});

test("legal pages are public", async ({ page }) => {
  for (const path of ["/privacy", "/terms"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(path));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});
