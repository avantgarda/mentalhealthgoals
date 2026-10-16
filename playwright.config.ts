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
const port = Number(process.env.E2E_PORT || 3210)
export const E2E_BASE_URL = `http://localhost:${port}`

/**
 * CI tests a production build: ci.yml runs `pnpm build` after loading the
 * fixture, and the suite starts `next start` on it. `next dev` compiles each
 * route on its first request and serves unminified bundles, which made the
 * job minutes slower. Locally the suite keeps `next dev`, so a change shows up
 * without a rebuild — `CI=1` locally therefore needs a `pnpm build` first.
 */
export const E2E_AGAINST_BUILD = !!process.env.CI

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry once on CI only: a real failure fails twice, a flake is reported as flaky. */
  retries: process.env.CI ? 1 : 0,
  /*
   * Spec files run side by side; the tests inside a file still run in order.
   * fullyParallel stays off: the admin spec shares one signed-in page from its
   * beforeAll, and two workers signing the fixture admin in at once clash.
   * Two workers measured fastest against the production build — four was slower.
   */
  workers: process.env.CI ? 2 : undefined,
  /*
   * On CI the list reporter puts every test and its time in the job log; the
   * HTML report is still written for the artifact uploaded on failure.
   * See https://playwright.dev/docs/test-reporters
   */
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'html',
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
    command: E2E_AGAINST_BUILD ? `pnpm start --port ${port}` : `pnpm dev --port ${port}`,
    // Match Payload's trusted origin to this isolated server. Tests never send real mail.
    env: {
      NEXT_PUBLIC_SERVER_URL: E2E_BASE_URL,
      VERCEL_ENV: '',
      RESEND_API_KEY: '',
      PAYLOAD_AUTH_EMAIL_TEST_TO: '',
    },
    reuseExistingServer: !process.env.CI,
    url: E2E_BASE_URL,
  },
})
