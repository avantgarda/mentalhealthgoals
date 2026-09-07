import { expect, test } from '@playwright/test'

import { FIXTURE } from '../fixtures/site'

const BAND = 'Funded and delivered by'

test.describe('Partner logos', () => {
  test('the accountability band names the funder and the delivery body on every page', async ({
    page,
  }) => {
    for (const path of ['/', '/about', '/search']) {
      await page.goto(path)
      const band = page.getByRole('region', { name: BAND })
      await expect(band).toBeVisible()
      for (const partner of FIXTURE.partner.inBand) {
        await expect(band.getByRole('img', { name: new RegExp(partner.name) })).toBeVisible()
      }
    }
  })

  test('the band names no delivery institution', async ({ page }) => {
    // Several institutions deliver the programme. The band is the site's one
    // every-page claim, so naming one of them there would read as precedence
    // over the rest.
    await page.goto('/')
    const band = page.getByRole('region', { name: BAND })

    const institutions = new Set(
      FIXTURE.workstreams.flatMap((workstream) =>
        workstream.deliveredBy.split('·').map((name) => name.trim()),
      ),
    )

    for (const institution of institutions) {
      await expect(band.getByText(institution, { exact: false })).toHaveCount(0)
    }
  })

  test('outbound partner links open in a new tab; internal ones do not', async ({ page }) => {
    await page.goto('/')
    const band = page.getByRole('region', { name: BAND })
    const outbound = FIXTURE.partner.inBand[1]
    await expect(band.getByRole('link', { name: new RegExp(outbound.name) })).toHaveAttribute(
      'target',
      '_blank',
    )

    // The workstreams index links the umbrella team to our own page — a new
    // tab would be wrong. Its label comes from the code, not the CMS.
    await page.goto('/workstreams')
    const umbrella = page.getByRole('link', { name: /About DIGIT/ })
    await expect(umbrella).toHaveAttribute('href', '/digit')
    await expect(umbrella).not.toHaveAttribute('target', '_blank')
  })

  test('a partner row on a page is labelled and links out', async ({ page }) => {
    const linked = FIXTURE.partner.external
    await page.goto('/')
    const row = page
      .getByRole('list')
      .filter({ has: page.getByRole('img', { name: new RegExp(linked.name) }) })
    await expect(row.getByRole('link', { name: new RegExp(linked.name) })).toHaveAttribute(
      'target',
      '_blank',
    )
  })

  test('a partner with no artwork is still credited, as a typographic lockup', async ({ page }) => {
    // Credit does not wait on permission: where there is no cleared logo the
    // name is set in type instead, and it still links out.
    const { name } = FIXTURE.partner.withoutLogo
    await page.goto('/about')
    await expect(page.getByText(name).first()).toBeVisible()
    await expect(page.getByRole('img', { name: new RegExp(name) })).toHaveCount(0)
  })

  test('a logo row inside an article is not styled as a bulleted list', async ({ page }) => {
    await page.goto(`/posts/${FIXTURE.posts.news.slug}`)
    const logo = page.getByRole('img', { name: new RegExp(FIXTURE.partner.external.name) })
    await expect(logo).toBeVisible()
    // Prose would otherwise give the row list markers and paragraph margins.
    const listStyle = await logo
      .locator('xpath=ancestor::ul[1]')
      .evaluate((el) => getComputedStyle(el).listStyleType)
    expect(listStyle).toBe('none')
  })

  test('each group in the band names itself', async ({ page }) => {
    await page.goto('/')
    const band = page.getByRole('region', { name: BAND })
    const delivered = band.getByRole('list', { name: 'Delivered by' })
    await expect(
      delivered.getByRole('img', { name: new RegExp(FIXTURE.partner.inBand[1].name) }),
    ).toBeVisible()
    // Each group names its own list rather than relying on visual grouping.
    await expect(band.getByRole('list', { name: 'Funded by' })).toBeVisible()
  })

  test('logo surfaces stay on a light ground in dark mode', async ({ page }) => {
    // Partner artwork is drawn for light grounds — black ink on a dark theme
    // would vanish while its link stayed focusable.
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('payload-theme', 'dark'))
    await page.reload()
    const band = page.getByRole('region', { name: BAND })
    const [bg, fg] = await band.evaluate((el) => {
      const s = getComputedStyle(el)
      return [s.backgroundColor, s.color]
    })
    const lum = (c: string) => {
      const m = c.match(/[\d.]+/g)
      return m ? Number(m[0]) : 0
    }
    // A light plate: the ground reads far brighter than the ink on it.
    expect(lum(bg)).toBeGreaterThan(lum(fg))
  })

  test('a workstream with a complete partner set shows it in the body', async ({ page }) => {
    await page.goto(`/workstreams/${FIXTURE.workstream.withPartners.slug}`)
    const row = page.locator('.partner-plate').first()
    await expect(row.getByText('Delivered with')).toBeVisible()
    await expect(
      row.getByRole('img', { name: new RegExp(FIXTURE.partner.external.name) }),
    ).toBeVisible()
  })

  test('workstream delivery institutions stay as text, with no logo hierarchy', async ({
    page,
  }) => {
    // Deliberate: a workstream's institutions are co-equal, and holding cleared
    // artwork for only one of them would invent a hierarchy.
    const workstream = FIXTURE.workstream.multiInstitution
    const [firstInstitution] = workstream.deliveredBy.split('·').map((name) => name.trim())

    await page.goto(`/workstreams/${workstream.slug}`)
    const deliveredBy = page
      .locator('article')
      .getByText('Delivered by', { exact: true })
      .locator('xpath=ancestor::div[1]')
    await expect(deliveredBy.getByText(firstInstitution)).toBeVisible()
    await expect(deliveredBy.getByRole('img')).toHaveCount(0)
  })
})
