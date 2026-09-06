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

  test('a team card is its own trigger: the biography opens from the portrait and closes to the name', async ({
    page,
  }) => {
    await page.goto('/people')
    const card = page.locator('#mitul-mehta')
    const bio = card.getByText(/Professor of Neuroimaging/)
    await expect(bio).toBeHidden()

    // Clicking the portrait, not the name, still opens it: the whole card is
    // the control, forwarded to the one real button.
    await card.locator('img').click()
    await expect(bio).toBeVisible()
    await expect(card.locator('dialog')).toHaveAttribute('open', '')

    // Escape closes it and focus comes back to the name — the platform's
    // dialog doing its job because the click went through the button.
    await page.keyboard.press('Escape')
    await expect(bio).toBeHidden()
    await expect(card.getByRole('button', { name: /Mitul Mehta/ })).toBeFocused()

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

  test('a passage with no heading is not indented past a gutter it does not have', async ({
    page,
  }) => {
    // The reading column steps right to clear the gutter label beside it. With
    // no heading there is no label, and the closing note on the Team page sat a
    // third of the way across the page with nothing to its left.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/people')

    const measured = await page.evaluate(() => {
      const note = [...document.querySelectorAll('p')].find((p) =>
        p.textContent?.startsWith('Governance connects'),
      )!
      const container = note.closest('.container')!
      const box = container.getBoundingClientRect()
      return {
        note: note.getBoundingClientRect().left,
        // The container's own left padding is the page's text edge.
        textEdge: box.left + parseFloat(getComputedStyle(container).paddingLeft),
      }
    })

    expect(measured.note).toBeCloseTo(measured.textEdge, 0)
  })

  test('the workstreams index is ruled, not boxed', async ({ page }) => {
    // A vertical rule down the left of each run gave the index a left edge and
    // a top edge with no right or bottom — a box someone had forgotten to
    // close. The labelled band marks each run; the rules stay horizontal.
    await page.goto('/workstreams')

    const sides = await page.evaluate(() =>
      [...document.querySelectorAll('.border-t.border-border > section')].map((s) => {
        const style = getComputedStyle(s)
        return [style.borderLeftWidth, style.borderRightWidth]
      }),
    )

    expect(sides.length).toBeGreaterThan(0)
    for (const [left, right] of sides) {
      expect(left).toBe('0px')
      expect(right).toBe('0px')
    }
  })

  test('a workstream title uses the width its column actually has', async ({ page }) => {
    // A `max-w-[16ch]` cap used to sit narrower than this column at every
    // width, breaking "Alliance Management Team" after its first word on
    // every screen. The column should be the only constraint.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/workstreams/alliance-management-team')

    const measured = await page.evaluate(() => {
      const h1 = document.querySelector('h1')!
      const range = document.createRange()
      range.selectNodeContents(h1)
      const lines = [...range.getClientRects()].map((r) => r.width)
      const available = h1.parentElement!.getBoundingClientRect().width
      return { lines: lines.length, widest: Math.max(...lines), available }
    })

    expect(measured.lines).toBe(1)
    expect(measured.widest).toBeLessThanOrEqual(measured.available + 1)
  })

  test('the team is ordered by workstream and then surname, never by hand', async ({ page }) => {
    await page.goto('/people')
    const leads = page.locator('section', {
      has: page.getByRole('heading', { name: 'Workstream leads' }),
    })
    const names = await leads.locator('[data-person-name]').allTextContents()
    expect(names).toEqual([
      'Prof. Mitul Mehta', // 01 Alliance Management Team
      'Dr Matthias Pierce',
      'Prof. Richard Emsley', // 02 Innovative Clinical Trials Hub
      'Prof. Paula Williamson',
      'Prof. Edward Harcourt', // 03 Lived Experience Industry Partnership
      'Dr Siân Rees',
      'Dr Trina Histon', // 04 Digital Innovation
      'Dr Pauline Whelan',
      'Prof. Ann John', // 05 Data Observatory
      'Prof. Rob Stewart',
      'Prof. Gerome Breen', // 06 Multi-omics
      'Prof. James Walters',
    ])
  })

  test('a biography is real page content, not data behind a click', async ({ page }) => {
    // The dialog is in the document from the first paint, so the text is in
    // the HTML for a crawler or reader mode — just not shown until asked for.
    const html = await (await page.request.get('/people')).text()
    expect(html).toContain('Professor of Neuroimaging')
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
