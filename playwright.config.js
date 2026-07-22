import { defineConfig, devices } from "@playwright/test";

const projects = [
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  },
  {
    name: "webkit",
    use: { ...devices["Desktop Safari"] },
  },
];

// The bundled Firefox runner currently fails before page creation on Windows
// with Node 24. CI runs it on Linux, where the browser is fully exercised.
if (process.platform !== "win32" || process.env.CI) {
  projects.splice(1, 0, {
    name: "firefox",
    use: { ...devices["Desktop Firefox"] },
  });
}

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.js",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects,
});
