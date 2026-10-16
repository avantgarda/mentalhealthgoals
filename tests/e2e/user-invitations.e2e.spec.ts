import { test, expect } from '@playwright/test'
import { login } from '../helpers/login'
import { FIXTURE } from '../fixtures/site'

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`invitation creation and disabled-mail recovery at ${viewport.width}px`, async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await page.setViewportSize(viewport)
    await login({ page, user: FIXTURE.admin })
    await page.goto('/admin/collections/users/create')
    await expect(page.getByRole('heading', { name: 'Invite user' })).toBeVisible()
    await page.getByLabel('Name', { exact: true }).fill('Invitation QA')
    await page
      .getByLabel('Email', { exact: true })
      .fill(`invite-${viewport.width}-${Date.now()}@example.test`)
    await expect(page.getByRole('combobox', { name: 'Role', exact: true })).toHaveValue('editor')
    await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Create account and send invitation' }).click()
    await expect(
      page.getByRole('alert').filter({ hasText: 'Account email sending is disabled' }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Open account and invitation status' }).click()
    await expect(page.getByRole('region', { name: 'Account status' })).toContainText(
      'Pending password setup',
    )
    const resend = page.getByRole('button', { name: 'Resend invitation' })
    await expect(resend).toBeVisible()
    await resend.click()
    await expect(
      page.getByRole('alert').filter({ hasText: 'Account email sending is disabled' }),
    ).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await page.screenshot({
      path: `test-results/invitation-pending-${viewport.width}.png`,
      fullPage: true,
    })
  })
}
