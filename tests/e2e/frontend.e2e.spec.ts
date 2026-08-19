import { test, expect } from '@playwright/test'

test.describe('Frontend', () => {
  test('can load homepage', async ({ page }) => {
    await page.goto('http://localhost:3000')
    await expect(page).toHaveTitle(/Mental Health Goals Programme/)
    const heading = page.locator('h1').first()
    await expect(heading).toContainText(/mental health/i)
  })
})
