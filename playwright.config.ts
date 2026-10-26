import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT) || 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Optional: use an already-installed Chromium (e.g. in CI images) instead of Playwright's own download.
        ...(process.env.E2E_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH } } : {}),
      },
    },
  ],
  webServer: {
    // Runs the production build. Set the Supabase env vars (and, for the full flow, AI_PROVIDER=mock
    // with NODE_ENV not "production" via `next dev`) before running; see the README testing section.
    command: process.env.E2E_DEV ? `npx next dev -p ${port}` : `npx next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
