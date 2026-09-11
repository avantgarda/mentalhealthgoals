import { test, expect } from '@playwright/test'

import { FIXTURE } from '../fixtures/site'
// A pure function with no imports of its own, so it is safe to pull into the
// Playwright process — unlike anything that reaches the Payload config.
import { personAnchor } from '../../src/utilities/personAnchor'

test.describe('Frontend', () => {
  test('can load homepage', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Mental Health Goals Programme/)
    const heading = page.locator('h1').first()
    await expect(heading).toContainText(FIXTURE.home.heading)
  })

  test('lists the news posts', async ({ page }) => {
    await page.goto('/posts')
    await expect(page.getByText(FIXTURE.posts.news.title).first()).toBeVisible()
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
    const { slug, title } = FIXTURE.workstream.withSections
    await page.goto('/workstreams')
    await expect(page.locator(`a[href="/workstreams/${slug}"]`).first()).toBeVisible()

    await page.goto(`/workstreams/${slug}`)
    await expect(page.locator('h1')).toContainText(title)
    await expect(page.getByRole('heading', { name: /primary focus/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /key questions/i })).toBeVisible()
  })

  test('a door opens from wherever it is pressed, not only from its words', async ({ page }) => {
    // A door's call to action stretches a pseudo-element over the whole row. The
    // shared Button once nudged down a pixel when pressed, which made the link
    // the containing block for its own ::after: the stretch shrank to the words
    // mid-press, and a click on the description was released outside it.
    for (const door of FIXTURE.doors) {
      await page.goto('/')
      const row = page.locator('main li.door', { hasText: door.heading })
      await row.hover()
      // Forced, because the description sits under the stretched link by
      // design, and Playwright otherwise refuses to click a covered element.
      await row.locator('p').click({ force: true })
      await page.waitForURL((url) => url.pathname === door.url)
    }
  })

  test('the workstreams index explains its umbrella team without logos', async ({ page }) => {
    await page.goto('/workstreams')
    await page.getByRole('link', { name: /About DIGIT/ }).click()
    await page.waitForURL(/\/digit$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(FIXTURE.umbrella.pageTitle)
    // Typographic by design: a page about one team inside the programme does
    // not get a logo the other workstreams' teams do not have.
    await expect(page.locator('main').getByRole('img')).toHaveCount(0)
  })

  test('industry has an address to write to, not only a form', async ({ page }) => {
    // A visitor who would rather write than fill something in should not have
    // to hunt for the address. The page does not type it: the "Programme
    // email" inline block renders whatever Programme details holds, so the
    // page and the footer cannot disagree.
    await page.goto('/industry')

    const mailto = page.locator('main a[href^="mailto:"]').first()
    await expect(mailto).toBeVisible()
    await expect(mailto).toContainText(FIXTURE.contactEmail)
    await expect(mailto).toHaveAttribute('href', `mailto:${FIXTURE.contactEmail}`)
    await expect(page.locator(`footer a[href="mailto:${FIXTURE.contactEmail}"]`)).toBeVisible()

    // The Forum is named as itself here, not as the meeting at which it
    // launches — those are different things and the page should say so.
    await expect(
      page.locator('main').getByRole('heading', { name: FIXTURE.forum.plainName, exact: true }),
    ).toBeVisible()
  })

  test('a meeting is named as a meeting, wherever it is announced', async ({ page }) => {
    // The Forum is a standing body and the launch meeting is one day of it.
    // Several surfaces used to name the day as though it were the Forum, which
    // read as though the Forum ended when the day did. Every surface that
    // announces the meeting should call it one.
    const { heading } = FIXTURE.forum

    await page.goto('/')
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()

    await page.goto('/industry-engagement-forum')
    await expect(page.locator('h1')).toContainText(heading)
    // The bar that follows the reader down the page says so too.
    await expect(page.locator('[data-sticky-cta]')).toContainText(FIXTURE.forum.stickyMessage)
  })

  test('a workstream shows its summary on the home page and its description on the index', async ({
    page,
  }) => {
    // Two fields, two jobs: the card index leads with the one-line summary,
    // the listing has room for the longer description. They were rendered
    // interchangeably once, which made the index unreadable.
    const workstream = FIXTURE.workstreams[0]

    await page.goto('/')
    await expect(page.getByText(workstream.summary).first()).toBeVisible()

    await page.goto('/workstreams')
    await expect(page.getByText(workstream.description).first()).toBeVisible()
  })

  test('an upcoming event is pinned above the news, and only appears once', async ({ page }) => {
    await page.goto('/posts')
    const band = page.getByRole('region', { name: 'Coming up' })
    await expect(band).toBeVisible()

    // The event leads with the date it happens, not the date it was announced.
    // Computed, because a literal here would stop being upcoming the day after
    // it passed and fail for a reason that has nothing to do with the code.
    const eventDay = new Date(Date.now() + FIXTURE.posts.event.daysAhead * 86_400_000)
    const shown = eventDay.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    await expect(band.getByText(shown)).toBeVisible()
    const forum = FIXTURE.posts.event.title
    await expect(band.getByRole('link', { name: forum })).toBeVisible()

    // Pinned above means lifted out of the list below, not copied into it.
    // Scoped to the listing: the footer carries its own link to the Forum page.
    const inTheListing = page.locator('main').getByRole('link', { name: forum })
    await expect(inTheListing).toHaveCount(1)
  })

  test('a team card is its own trigger: the biography opens from the portrait and closes to the name', async ({
    page,
  }) => {
    const person = FIXTURE.person.lead
    await page.goto('/people')
    const card = page.locator(`#${personAnchor(person.name)}`)
    const bio = card.getByText(person.bio)
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
    await expect(card.getByRole('button', { name: person.name })).toBeFocused()

    // The workstream comes before the institution — this is a programme site.
    const workstreamTitle = FIXTURE.workstreams.find((w) => w.slug === person.workstreams[0])!.title
    // innerText reflects `text-transform`, and the card sets the workstream in
    // capitals — so this compares case-insensitively rather than against what
    // the CMS stores.
    const order = await card.evaluate(
      (el, { workstreamTitle: ws, organisation }) => {
        const text = (el as HTMLElement).innerText.toLowerCase()
        return {
          workstream: text.indexOf(ws.toLowerCase()),
          institution: text.indexOf(organisation.toLowerCase()),
        }
      },
      { organisation: person.organisation, workstreamTitle },
    )
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

    const measured = await page.evaluate(
      (note) => {
        const paragraph = [...document.querySelectorAll('p')].find((p) =>
          p.textContent?.startsWith(note),
        )!
        const container = paragraph.closest('.container')!
        const box = container.getBoundingClientRect()
        return {
          note: paragraph.getBoundingClientRect().left,
          // The container's own left padding is the page's text edge.
          textEdge: box.left + parseFloat(getComputedStyle(container).paddingLeft),
        }
      },
      FIXTURE.closingNote.slice(0, 20),
    )

    expect(measured.note).toBeCloseTo(measured.textEdge, 0)
  })

  test('no passage on the site is offset past a gutter that is empty', async ({ page }) => {
    // The general form of the bug the Team page showed: a column steps right to
    // clear a gutter — a label, a heading, an "on this page" nav — and the
    // gutter turns out to be empty, so the passage sits adrift with blank
    // ground to its left. Every one of those gutters is conditional on CMS
    // content, so this has to be checked as a shape, not case by case.
    //
    // A centred measure legitimately has empty ground on its left; it has the
    // same amount on its right. Only a lopsided one is a mistake.
    const detect = () => {
      const found: string[] = []
      for (const el of document.querySelectorAll<HTMLElement>('*')) {
        const start = Number(getComputedStyle(el).gridColumnStart)
        if (!start || start <= 1 || Number.isNaN(start)) continue
        const grid = el.parentElement
        if (!grid || !getComputedStyle(grid).display.includes('grid')) continue

        const mine = el.getBoundingClientRect()
        const track = grid.getBoundingClientRect()
        if (mine.width === 0) continue

        const occupied = [...grid.children].some((sib) => {
          if (sib === el) return false
          const box = sib.getBoundingClientRect()
          return (
            box.right <= mine.left + 1 &&
            box.width > 0 &&
            box.height > 0 &&
            !!sib.textContent?.trim()
          )
        })
        if (occupied) continue

        // Centred is fine. Lopsided is the bug.
        const gapLeft = mine.left - track.left
        const gapRight = track.right - mine.right
        if (Math.abs(gapLeft - gapRight) > 24)
          found.push(
            `${el.tagName}.${el.className} — ${Math.round(gapLeft)}px of nothing to its left`,
          )
      }
      return found
    }

    await page.setViewportSize({ width: 1440, height: 900 })
    const paths = [
      '/',
      '/about',
      '/people',
      '/contact',
      '/digit',
      '/workstreams',
      '/posts',
      '/industry-engagement-forum',
    ]

    for (const path of paths) {
      await page.goto(path)
      await page.locator('#main-content').waitFor()
      expect(await page.evaluate(detect), `stranded passage on ${path}`).toEqual([])
    }

    // The state a crawl never reaches: the intro on the left goes away once a
    // form has been sent, and the offset has to go with it.
    await page.goto('/contact')
    await page.locator('form').waitFor()
    await page.route('**/api/form-submissions', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"doc":{}}' }),
    )
    await page.locator('form input').first().fill('Test Person')
    const email = page.locator('form input[type="email"], form input[name*="mail" i]').first()
    if (await email.count()) await email.fill('test@example.com')
    const message = page.locator('form textarea').first()
    if (await message.count()) await message.fill('Hello')
    await page.locator('form button[type="submit"]').first().click()
    await expect(page.locator('form')).toHaveCount(0)
    expect(await page.evaluate(detect), 'stranded confirmation on /contact').toEqual([])
  })

  test('the hero keeps its ridge until somebody asks for the other one', async ({ page }) => {
    // The alternative motif is armed by a key sequence and lives in the tab, so
    // it can never be left switched on for visitors — and the artwork is inlined
    // into its own dynamic chunk rather than served from `public/`, so there is
    // no address anybody can fetch it from either.
    //
    // The assertions are on requests and on the served file, not on the chunk.
    // This suite runs against `next dev`, which fetches dynamic chunks eagerly;
    // the production build is where the chunk stays put, and asserting on it
    // here would be a test that passes for the wrong reason.
    const artwork: string[] = []
    page.on('request', (request) => {
      if (/motif-b|\.webp/.test(request.url())) artwork.push(request.url())
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('.ridge').first()).toBeAttached()
    await page.waitForTimeout(500)
    expect(artwork, 'the artwork was fetched by a page that never asked for it').toEqual([])

    // The address it used to have, and any other guess at it, is not served.
    for (const guess of ['/motif-b.png', '/motif-b.webp', '/freud.png']) {
      const probe = await page.request.get(guess)
      expect(probe.status(), `${guess} is reachable without the sequence`).toBe(404)
    }

    const sequence = ['ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'f', 'r', 'e', 'u', 'd']
    const enter = async () => {
      for (const key of sequence) await page.keyboard.press(key)
    }

    // The sequence must not move the page. Up and down arrows scrolled the hero
    // out from under the person entering it, which is why they are not in it.
    const before = await page.evaluate(() => window.scrollY)
    await enter()
    expect(await page.evaluate(() => window.scrollY), 'the sequence scrolled the page').toBe(before)

    const motif = page.locator('.alt-motif-plate').first()
    await expect(motif).toBeVisible()
    await expect(page.locator('.ridge')).toHaveCount(0)
    // It arrived with the chunk rather than over the wire.
    const src = await motif
      .locator('img')
      .evaluate((el) => (el as HTMLImageElement).src.slice(0, 32))
    expect(src).toContain('data:image/webp;base64,')
    expect(artwork, 'the artwork was fetched rather than carried').toEqual([])

    // Whole, and inside the page: the ridge is anchored past the right of the
    // screen on purpose, and a figure that inherits that is cut in half.
    const fits = await page.evaluate(() => {
      const plate = document.querySelector('.alt-motif-plate')!.getBoundingClientRect()
      return {
        withinViewport: plate.right <= window.innerWidth && plate.left >= 0,
        withinHero: (() => {
          const hero = document.querySelector('[data-hero-theme="dark"]')!.getBoundingClientRect()
          return plate.top >= hero.top && plate.bottom <= hero.bottom
        })(),
        overflows: document.documentElement.scrollWidth > window.innerWidth,
      }
    })
    expect(fits).toEqual({ withinViewport: true, withinHero: true, overflows: false })

    // And the same sequence puts the ridge back.
    await enter()
    await expect(page.locator('.ridge').first()).toBeAttached()
    await expect(page.locator('.alt-motif-plate')).toHaveCount(0)
  })

  test('the statements sit in the small print, not among the sections', async ({ page }) => {
    // Accessibility and privacy belong beside the copyright, which is where
    // people look for them — and the Site list should read as the site's own
    // sections. Which links move is an editor's choice in the CMS, not a rule
    // the code infers from a URL, so this checks the placement rather than
    // naming the two that happen to carry the flag today.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const siteNav = page.getByRole('navigation', { name: 'Footer navigation' })
    await expect(siteNav.getByRole('link', { name: /accessibility/i })).toHaveCount(0)
    await expect(siteNav.getByRole('link', { name: /privacy/i })).toHaveCount(0)
    await expect(siteNav.getByRole('link', { name: 'About' })).toBeVisible()

    const footer = page.locator('footer')
    for (const name of [/accessibility/i, /privacy/i]) {
      const link = footer.getByRole('link', { name })
      await expect(link).toHaveCount(1)
      await expect(link).toBeVisible()
      // Below the site list, on the rule with the copyright.
      const below = await link.evaluate((el, navSel) => {
        const nav = document.querySelector(navSel)!
        return el.getBoundingClientRect().top > nav.getBoundingClientRect().bottom
      }, 'footer nav[aria-label="Footer navigation"]')
      expect(below).toBe(true)
    }

    // Two columns rather than one tower, so the list can grow.
    const columns = await siteNav.evaluate((nav) => {
      const lefts = [...nav.querySelectorAll('li')].map((li) =>
        Math.round(li.getBoundingClientRect().left),
      )
      return new Set(lefts).size
    })
    expect(columns).toBe(2)
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
    // width, breaking a two-word title after its first word on every screen.
    // The column should be the only constraint.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/workstreams/${FIXTURE.workstream.shortTitle.slug}`)

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
    // Lowest workstream number first, then surname. One of these people is on
    // two workstreams and must sort under the lower; another carries a
    // deliberately misleading `order` value, which nothing reads.
    expect(names).toEqual([...FIXTURE.expectedLeadOrder])
  })

  test('a biography is real page content, not data behind a click', async ({ page }) => {
    // The dialog is in the document from the first paint, so the text is in
    // the HTML for a crawler or reader mode — just not shown until asked for.
    const html = await (await page.request.get('/people')).text()
    expect(html).toContain(FIXTURE.person.lead.bio)
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
