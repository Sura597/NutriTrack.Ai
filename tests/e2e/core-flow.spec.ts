import { test, expect } from "@playwright/test";

/**
 * Full user journey. Needs a real Supabase project with the migrations applied and a
 * CONFIRMED test account (create one in the Supabase dashboard, or sign up and confirm
 * the email by hand). It is skipped unless the credentials are provided, so it never
 * runs against a project by accident:
 *
 *   E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
 *
 * The test account should be new/empty: it completes onboarding if needed and deletes
 * the meal it creates. Text logging uses only foods from the built-in food table, so no
 * AI provider is required.
 */
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("core flow", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run against a real Supabase project");

  test("sign in, onboard, log by text, edit, delete, sign out", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/(dashboard|onboarding)/);

    if (page.url().includes("/onboarding")) {
      await page.getByLabel("Name").fill("E2E Tester");
      await page.getByLabel("Date of birth").fill("1992-04-15");
      await page.getByLabel("Height (cm)").fill("168");
      await page.getByLabel("Current weight (kg)").fill("66");
      await page.getByRole("button", { name: "Finish setup" }).click();
    }
    await expect(page).toHaveURL(/\/dashboard/);

    // Log by text
    await page.getByRole("button", { name: /log food/i }).first().click();
    await page.getByRole("tab", { name: "Text" }).click();
    await page.getByLabel("What did you eat?").fill("2 roti and 1 bowl dal");
    await page.getByRole("button", { name: "Analyse meal" }).click();
    await expect(page.getByRole("list", { name: "Foods in this meal" })).toBeVisible();
    await page.getByRole("button", { name: "Save meal" }).click();
    await expect(page.getByText(/roti/i).first()).toBeVisible();

    // Edit
    await page.getByRole("button", { name: "Edit meal" }).first().click();
    await page.getByRole("button", { name: "Save changes" }).click();

    // Delete
    await page.getByRole("button", { name: "Delete meal" }).first().click();
    await page.getByRole("button", { name: /^delete$/i }).click();

    // Other pages render for a signed-in user
    await page.goto("/insights");
    await expect(page.getByRole("heading", { name: "Insights" })).toBeVisible();
    await page.goto("/foods");
    await expect(page.getByRole("heading", { name: /budget/i })).toBeVisible();

    // Sign out
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /sign out/i }).first().click();
    await expect(page).toHaveURL(/\/(sign-in|$)/);
  });
});
