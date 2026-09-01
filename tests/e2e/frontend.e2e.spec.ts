import { test, expect } from '@playwright/test'

test.describe('Frontend', () => {
  test('can load homepage', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Mental Health Goals Programme/)
    const heading = page.locator('h1').first()
    await expect(heading).toContainText(/mental health/i)
  })

  test('lists the seeded news posts', async ({ page }) => {
    await page.goto('/posts')
    await expect(page.getByText(/£50 million commitment/i).first()).toBeVisible()
  })

  test('serves the legal pages from the footer', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('footer a[href="/privacy"]')).toBeVisible()
    await expect(page.locator('footer a[href="/accessibility"]')).toBeVisible()

    await page.goto('/accessibility')
    await expect(page.locator('h1')).toContainText(/accessibility statement/i)

    await page.goto('/privacy')
    await expect(page.locator('h1')).toContainText(/privacy notice/i)
  })

  test('serves workstream detail pages from the listing', async ({ page }) => {
    await page.goto('/workstreams')
    await expect(
      page.locator('a[href="/workstreams/alliance-management-team"]').first(),
    ).toBeVisible()

    await page.goto('/workstreams/alliance-management-team')
    await expect(page.locator('h1')).toContainText(/alliance management team/i)
    await expect(page.getByRole('heading', { name: /primary focus/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /key questions/i })).toBeVisible()
  })

  test('the well-known icon paths follow the brand', async ({ request }) => {
    // Fetchers that never read the <link> tags — browsers guessing
    // /favicon.ico, dashboard icon scrapers — must still get the current
    // mark, not a stale file shadowing the path from public/.
    for (const path of ['/favicon.ico', '/favicon.png', '/favicon.svg', '/apple-touch-icon.png']) {
      const response = await request.get(path, { maxRedirects: 0 })
      expect(response.status(), path).toBe(302)
      // NextResponse.redirect emits an absolute URL
      expect(response.headers()['location'], path).toMatch(/\/brand\/[a-zA-Z]+\//)

      const followed = await request.get(path)
      expect(followed.status(), path).toBe(200)
    }
  })

  test('unknown pages return the 404 page', async ({ page }) => {
    const response = await page.goto('/definitely-not-a-page')
    expect(response?.status()).toBe(404)
  })
})
