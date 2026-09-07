import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from `.env.local` — what `vercel env pull` writes
 * and what Next reads first. dotenv's default entry point only reads `.env`,
 * so the path is given explicitly. Ambient variables win: CI sets them on the
 * job and never writes a file.
 * https://github.com/motdotla/dotenv
 */
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

// A dedicated port so the suite never attaches to some other project's dev
// server that happens to be running on 3000.
export const E2E_BASE_URL = 'http://localhost:3210'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: E2E_BASE_URL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    command: 'pnpm dev --port 3210',
    reuseExistingServer: !process.env.CI,
    url: E2E_BASE_URL,
  },
})
