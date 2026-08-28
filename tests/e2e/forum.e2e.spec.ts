import { test, expect } from '@playwright/test'

/**
 * The Industry Engagement Forum page runs to roughly six screens on desktop
 * and eight on a phone. Before the sticky bar its only call to action sat 84%
 * of the way down, so these cover the path a visitor actually takes: scroll,
 * see the ask, land on the form, register.
 */
test.describe('Industry Engagement Forum', () => {
  test('the register block is anchored so the bar can reach it', async ({ page }) => {
    await page.goto('/industry-engagement-forum')
    // The anchor comes from the block's `blockName`, not a bespoke field.
    await expect(page.locator('#register')).toHaveCount(1)
    await expect(
      page.locator('#register').getByRole('heading', { name: /register your interest/i }),
    ).toBeVisible()
  })

  test('the sticky bar waits for the hero, then offers the form', async ({ page }) => {
    await page.goto('/industry-engagement-forum')
    const bar = page.locator('[data-sticky-cta]')

    await expect(bar).not.toHaveAttribute('data-visible', '')

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.2))
    await expect(bar).toHaveAttribute('data-visible', '')
    await expect(bar.getByRole('link', { name: /register your interest/i })).toHaveAttribute(
      'href',
      '#register',
    )
  })

  test('the bar steps aside once the ask is already on screen', async ({ page }) => {
    await page.goto('/industry-engagement-forum')
    const bar = page.locator('[data-sticky-cta]')

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.2))
    await expect(bar).toHaveAttribute('data-visible', '')

    // The block it points at — no sense asking someone to go where they are.
    await page.locator('#register').scrollIntoViewIfNeeded()
    await expect(bar).not.toHaveAttribute('data-visible', '')

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.2))
    await expect(bar).toHaveAttribute('data-visible', '')

    // And the page's own closing call to action.
    await page.locator('[data-cta-band]').scrollIntoViewIfNeeded()
    await expect(bar).not.toHaveAttribute('data-visible', '')
  })

  test('the bar can be dismissed, and stays dismissed for the session', async ({ page }) => {
    await page.goto('/industry-engagement-forum')
    const bar = page.locator('[data-sticky-cta]')

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.2))
    await expect(bar).toHaveAttribute('data-visible', '')

    await page.getByRole('button', { name: /dismiss/i }).click()
    await expect(bar).not.toHaveAttribute('data-visible', '')

    await page.reload()
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.2))
    await page.waitForTimeout(400)
    await expect(bar).not.toHaveAttribute('data-visible', '')
  })

  test('the bar publishes its height so focus is never hidden behind it', async ({ page }) => {
    await page.goto('/industry-engagement-forum')
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.2))
    await expect(page.locator('[data-sticky-cta]')).toHaveAttribute('data-visible', '')

    // WCAG 2.2 SC 2.4.11 — scroll-padding-bottom keys off this.
    const padding = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollPaddingBottom,
    )
    expect(parseInt(padding, 10)).toBeGreaterThan(16)
  })

  test('a registration reaches the CMS', async ({ page }) => {
    await page.goto('/industry-engagement-forum#register')

    const form = page.locator('#register form')
    await form.getByLabel('Full name').fill('Test Registrant')
    await form.getByLabel('Organisation').fill('Example Pharma')
    await form.getByLabel('Role or job title').fill('Head of Clinical Development')
    await form.getByLabel('Email').fill('test.registrant@example.com')

    // A Radix select, not a native one.
    await form.getByRole('combobox').click()
    await page.getByRole('option', { name: /would like to attend/i }).click()

    await form.getByLabel(/access or dietary/i).fill('Step-free access')
    await form.getByRole('checkbox').click()

    const submission = page.waitForResponse(
      (res) => res.url().includes('/api/form-submissions') && res.request().method() === 'POST',
    )
    await form.getByRole('button', { name: /register your interest/i }).click()
    expect((await submission).status()).toBeLessThan(400)

    await expect(page.getByText(/your interest is registered/i)).toBeVisible()
  })
})
