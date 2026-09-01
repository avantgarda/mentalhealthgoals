import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Automated WCAG 2.2 AA scanning with axe-core, plus keyboard-access checks.
 * Automation catches roughly a third of WCAG issues (contrast, names/labels,
 * ARIA misuse, landmark/heading structure) — the accessibility statement
 * should still describe this as a self-assessment, not a formal audit.
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

const scan = async (page: Page) => {
  // Never scan a half-rendered page (cold dev-server compiles on CI)
  await page.locator('#main-content').waitFor()
  // Streaming metadata can land the <title> a beat after the shell on a cold
  // server; axe's document-title rule must see the finished document.
  await page.waitForFunction(() => document.title.length > 0)
  // Let entrance animations and scroll reveals finish — axe measures colour
  // contrast on the current frame, and a word mid-fade is not a real failure.
  //
  // Waiting on `getAnimations()` alone is not enough: a `[data-reveal]` element
  // below the fold has no transition running yet, so there is nothing to wait
  // for, and it is still sitting at `opacity: 0` when axe reads it. Put every
  // reveal in the state the visitor eventually sees first — the same thing the
  // observer does on scroll, and what `data-motion="off"` does immediately —
  // then let anything already in flight settle. Without this the scan is a
  // race, and it lost under load on CI.
  await page.evaluate(async () => {
    document
      .querySelectorAll('[data-reveal]:not(.is-in)')
      .forEach((element) => element.classList.add('is-in'))
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)))
  })

  // The suite runs against `next dev`; the dev-tools overlay (<nextjs-portal>)
  // injects itself into the page and, when it surfaces an issue badge, breaks
  // axe's skip-link exemption for the region rule. It does not exist in
  // production, so keep it out of the scan.
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .exclude('nextjs-portal')
    .analyze()

  // Readable failure output instead of a wall of JSON
  return violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} — ${v.nodes
        .slice(0, 5)
        .map((n) => n.target.join(' '))
        .join(' | ')}`,
  )
}

const STATIC_PAGES = [
  '/',
  '/posts',
  '/contact',
  '/privacy',
  '/accessibility',
  '/search',
  // Carries the registration form and the sticky call-to-action bar.
  '/industry-engagement-forum',
]

test.describe('axe-core WCAG 2.2 AA scans', () => {
  for (const path of STATIC_PAGES) {
    test(`${path} has no violations`, async ({ page }) => {
      await page.goto(path)
      expect(await scan(page)).toEqual([])
    })
  }

  test('first news post has no violations', async ({ page }) => {
    await page.goto('/posts')
    const first = page.locator('article a[href^="/posts/"]').first()
    await first.waitFor()
    await first.click()
    await page.waitForURL(/\/posts\/.+/)
    expect(await scan(page)).toEqual([])
  })

  test('workstreams listing and every detail page have no violations', async ({ page }) => {
    await page.goto('/workstreams')
    expect(await scan(page)).toEqual([])

    const hrefs = await page
      .locator('a[href^="/workstreams/"]')
      .evaluateAll((links) => [...new Set(links.map((l) => l.getAttribute('href')))])
    expect(hrefs.length).toBeGreaterThanOrEqual(6)

    for (const href of hrefs) {
      await page.goto(href!)
      expect(await scan(page), `violations on ${href}`).toEqual([])
    }
  })

  test('404 page has no violations', async ({ page }) => {
    await page.goto('/definitely-not-a-page')
    // On a cold CI dev server the not-found boundary compiles lazily and axe
    // can catch an intermediate shell — wait for the real page first.
    await expect(page.locator('#main-content h1')).toContainText('404')
    expect(await scan(page)).toEqual([])
  })
})

test.describe('axe-core scans in dark mode', () => {
  test.use({ colorScheme: 'dark' })

  test('homepage has no violations in dark mode', async ({ page }) => {
    await page.goto('/')
    expect(await scan(page)).toEqual([])
  })

  test('contact page has no violations in dark mode', async ({ page }) => {
    await page.goto('/contact')
    expect(await scan(page)).toEqual([])
  })
})

test.describe('keyboard access', () => {
  test('skip link is the first tab stop and jumps to main content', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')

    const skipLink = page.getByRole('link', { name: /skip to main content/i })
    await expect(skipLink).toBeFocused()
    await expect(skipLink).toBeVisible()

    await page.keyboard.press('Enter')
    await expect(page.locator('#main-content')).toBeFocused()
  })

  test('contact form is fully reachable by keyboard', async ({ page }) => {
    await page.goto('/contact')

    const fields = page.locator('form input:visible, form textarea:visible, form button:visible')
    const count = await fields.count()
    expect(count).toBeGreaterThanOrEqual(2)

    // Tab from the top of the document; every form control must receive focus
    const reached = new Set<number>()
    for (let i = 0; i < 60 && reached.size < count; i++) {
      await page.keyboard.press('Tab')
      for (let f = 0; f < count; f++) {
        if (await fields.nth(f).evaluate((el) => el === document.activeElement)) reached.add(f)
      }
    }
    expect(reached.size).toBe(count)
  })

  test('tabbing never gets trapped and reaches the footer', async ({ page }) => {
    await page.goto('/')

    let footerReached = false
    for (let i = 0; i < 80 && !footerReached; i++) {
      await page.keyboard.press('Tab')
      footerReached = await page.evaluate(() => !!document.activeElement?.closest('footer'))
    }
    expect(footerReached).toBe(true)
  })
})
