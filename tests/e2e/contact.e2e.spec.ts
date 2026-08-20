import { test, expect } from '@playwright/test'

/**
 * The contact form is the site's core call to action — this exercises the
 * whole chain: seeded form → form-builder block → submission API →
 * confirmation message. Requires a seeded database.
 */
test.describe('Contact form', () => {
  test('can submit an enquiry and see the confirmation', async ({ page }) => {
    await page.goto('/contact')

    await page.fill('#full-name', 'E2E Test')
    await page.fill('#email', 'e2e@test.local')
    await page.fill('#message', 'Automated end-to-end test message — please ignore.')

    await page.click('button[type="submit"]')

    await expect(page.getByText(/your message has been received/i)).toBeVisible({
      timeout: 15000,
    })
  })
})
