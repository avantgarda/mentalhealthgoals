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

  test('the workstreams index explains its umbrella team without logos', async ({ page }) => {
    await page.goto('/workstreams')
    await page.getByRole('link', { name: /About DIGIT/ }).click()
    await page.waitForURL(/\/digit$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /Data and Digital Industry Alliance Team/i,
    )
    // Typographic by design: a page about one team inside the programme does
    // not get a logo the other workstreams' teams do not have.
    await expect(page.locator('main').getByRole('img')).toHaveCount(0)
  })

  test('an upcoming event is pinned above the news, and only appears once', async ({ page }) => {
    await page.goto('/posts')
    const band = page.getByRole('region', { name: 'Coming up' })
    await expect(band).toBeVisible()

    // The event leads with the date it happens, not the date it was announced.
    await expect(band.getByText('8 Oct 2026')).toBeVisible()
    const forum = /Industry Engagement Forum/
    await expect(band.getByRole('link', { name: forum })).toBeVisible()

    // Pinned above means lifted out of the list below, not copied into it.
    // Scoped to the listing: the footer carries its own link to the Forum page.
    const inTheListing = page.locator('main').getByRole('link', { name: forum })
    await expect(inTheListing).toHaveCount(1)
  })

  test('team cards keep their biography behind a disclosure', async ({ page }) => {
    await page.goto('/people')
    const card = page.locator('#mitul-mehta')

    // Closed by default: twenty open biographies made the page enormous.
    const bio = card.getByText(/Professor of Neuroimaging/)
    await expect(bio).toBeHidden()

    await card.getByText('Read more').click()
    await expect(bio).toBeVisible()

    // The workstream comes before the institution — this is a programme site.
    const order = await card.evaluate((el) => {
      const text = (el as HTMLElement).innerText
      return {
        workstream: text.indexOf('Alliance Management Team'),
        institution: text.indexOf('King’s College London'),
      }
    })
    expect(order.workstream).toBeGreaterThan(-1)
    expect(order.workstream).toBeLessThan(order.institution)
  })

  test('the well-known icon paths follow the brand', async ({ request }) => {
    // Fetchers that never read the <link> tags — browsers guessing
    // /favicon.ico, dashboard icon scrapers — must still get the current
    // mark, not a stale file shadowing the path from public/.
    for (const path of ['/favicon.ico', '/favicon.png', '/favicon.svg', '/apple-touch-icon.png']) {
      // A direct 200, not a redirect: icon scrapers refuse to follow them.
      const response = await request.get(path, { maxRedirects: 0 })
      expect(response.status(), path).toBe(200)
      expect(response.headers()['content-type'], path).toMatch(/^image\//)
      expect((await response.body()).length, path).toBeGreaterThan(100)
    }
  })

  test('unknown pages return the 404 page', async ({ page }) => {
    const response = await page.goto('/definitely-not-a-page')
    expect(response?.status()).toBe(404)
  })
})
