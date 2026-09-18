// @ts-check
const { defineConfig, devices } = require("@playwright/test");

const PORT = process.env.PORT || 4173;

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    // Only set on machines/CI where a pre-installed Chromium is provided at a
    // non-standard path instead of the one Playwright manages itself
    // (`npx playwright install chromium`). Leave PW_EXECUTABLE_PATH unset on a
    // normal dev machine.
    launchOptions: process.env.PW_EXECUTABLE_PATH
      ? { executablePath: process.env.PW_EXECUTABLE_PATH }
      : {}
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ],
  webServer: {
    command: "node scripts/static-server.js",
    url: `http://127.0.0.1:${PORT}`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI
  }
});
