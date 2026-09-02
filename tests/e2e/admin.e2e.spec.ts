import { test, expect, Page } from '@playwright/test'
import { E2E_BASE_URL } from '../../playwright.config'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

test.describe('Admin Panel', () => {
  // The cold-compile warm-up in beforeAll needs headroom beyond the default.
  test.describe.configure({ timeout: 240_000 })

  let page: Page

  test.beforeAll(async ({ browser }) => {
    // A hook keeps its own 30s budget regardless of the describe's timeout, and
    // this one signs in and compiles the admin bundle. Raise it here or the
    // whole suite fails on a cold `.next` before a single assertion runs.
    test.setTimeout(240_000)
    await seedTestUser()

    // Contexts created manually don't inherit `use` options — pass baseURL
    const context = await browser.newContext({ baseURL: E2E_BASE_URL })
    page = await context.newPage()

    await login({ page, user: testUser })

    // Warm the admin bundle once, here, where a generous timeout is honest
    // about what is happening: the suite runs against `next dev`, so the
    // first visit to each admin route pays a cold compile that can exceed a
    // single assertion's timeout. Charging it to beforeAll keeps the tests
    // measuring the admin rather than the compiler, and stops CI leaning on
    // its retries.
    for (const route of ['/admin', '/admin/collections/users', '/admin/collections/pages/create']) {
      await page.goto(route, { timeout: 180_000, waitUntil: 'domcontentloaded' })
    }
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('can navigate to dashboard', async () => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin$/)
    const dashboardArtifact = page.locator('span[title="Dashboard"]').first()
    await expect(dashboardArtifact).toBeVisible()
  })

  test('can navigate to list view', async () => {
    await page.goto('/admin/collections/users')
    await expect(page).toHaveURL(/\/admin\/collections\/users/)
    const listViewArtifact = page.locator('h1', { hasText: 'Users' }).first()
    await expect(listViewArtifact).toBeVisible()
  })

  test('can navigate to edit view', async () => {
    await page.goto('/admin/collections/pages/create')
    await expect(page).toHaveURL(/\/admin\/collections\/pages\/[a-zA-Z0-9-_]+/)
    const editViewArtifact = page.locator('input[name="title"]')
    await expect(editViewArtifact).toBeVisible()
  })
})
