import { test, expect } from '@playwright/test'

import { FIXTURE } from '../fixtures/site'

/**
 * The contact form is the site's core call to action — this exercises the
 * whole chain: form → form-builder block → submission API → confirmation
 * message. Needs the fixture loaded (`pnpm fixture`).
 */
test.describe('Contact form', () => {
  test('can submit an enquiry and see the confirmation', async ({ page }) => {
    await page.goto('/contact')

    await page.fill(`#${FIXTURE.contact.fields.name}`, 'E2E Test')
    await page.fill(`#${FIXTURE.contact.fields.email}`, 'e2e@test.local')
    await page.fill(
      `#${FIXTURE.contact.fields.message}`,
      'Automated end-to-end test message — please ignore.',
    )

    await page.click('button[type="submit"]')

    await expect(page.getByText(FIXTURE.contact.confirmation)).toBeVisible({
      timeout: 15000,
    })

    // The thank-you sits on the same left edge as every other heading on the
    // page. A second `container` nested inside the block's own once stepped
    // it in by the page's side padding.
    const [title, confirmation] = await Promise.all([
      page.locator('main h1').first().boundingBox(),
      page.getByText(FIXTURE.contact.confirmation).boundingBox(),
    ])
    expect(Math.round(confirmation!.x)).toBe(Math.round(title!.x))
  })
})
