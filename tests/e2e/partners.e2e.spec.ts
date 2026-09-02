import { expect, test } from '@playwright/test'

test.describe('Partner logos', () => {
  test('the accountability band names the funder and shows the delivery lead on every page', async ({
    page,
  }) => {
    for (const path of ['/', '/about', '/search']) {
      await page.goto(path)
      const band = page.getByRole('region', { name: 'Funded and delivered by' })
      await expect(band).toBeVisible()
      // The funder has no cleared artwork yet, so it renders as a text lockup —
      // the permission switch working as designed.
      await expect(band.getByText('Office for Life Sciences')).toBeVisible()
      await expect(band.getByText('UK Government')).toBeVisible()
      // The delivery lead has artwork: a real image named for the organisation.
      await expect(band.getByRole('img', { name: /King’s College London/ })).toBeVisible()
    }
  })

  test('outbound partner links open in a new tab; internal ones do not', async ({ page }) => {
    await page.goto('/')
    const band = page.getByRole('region', { name: 'Funded and delivered by' })
    await expect(band.getByRole('link', { name: /King’s College London/ })).toHaveAttribute(
      'target',
      '_blank',
    )
    // DIGIT points at our own /about — a new tab would be wrong.
    const digit = band.getByRole('link', { name: /DIGIT/ })
    await expect(digit).toHaveAttribute('href', '/about')
    await expect(digit).not.toHaveAttribute('target', '_blank')
  })

  test('a partner row on a page is labelled and links out', async ({ page }) => {
    await page.goto('/')
    const row = page.getByRole('list').filter({ has: page.getByRole('img', { name: /DATAMIND/ }) })
    await expect(row.getByRole('link', { name: /DATAMIND/ })).toHaveAttribute('target', '_blank')
    await expect(page.getByRole('img', { name: /GLAD/ })).toBeVisible()
  })

  test('a logo row inside an article is not styled as a bulleted list', async ({ page }) => {
    await page.goto('/posts/datamind-and-the-programmes-data-infrastructure')
    const logo = page.getByRole('img', { name: /DATAMIND/ })
    await expect(logo).toBeVisible()
    // Prose would otherwise give the row list markers and paragraph margins.
    const listStyle = await logo
      .locator('xpath=ancestor::ul[1]')
      .evaluate((el) => getComputedStyle(el).listStyleType)
    expect(listStyle).toBe('none')
  })

  test('the band names the funder and the delivery body the site’s own copy names', async ({
    page,
  }) => {
    await page.goto('/')
    const band = page.getByRole('region', { name: 'Funded and delivered by' })
    // The About page says the programme is funded by OLS and delivered by the
    // MRC; the band must not contradict it.
    await expect(band.getByText('Medical Research Council')).toBeVisible()
    // Each group names its own list rather than relying on visual grouping.
    const delivered = band.getByRole('list', { name: 'Delivered by' })
    await expect(delivered.getByText('Medical Research Council')).toBeVisible()
    await expect(band.getByRole('list', { name: 'Funded by' })).toBeVisible()
  })

  test('logo surfaces stay on a light ground in dark mode', async ({ page }) => {
    // Partner artwork is drawn for light grounds — DATAMIND's mark is black
    // ink, so on the dark theme it would vanish while its link stayed
    // focusable.
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('payload-theme', 'dark'))
    await page.reload()
    const band = page.getByRole('region', { name: 'Funded and delivered by' })
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
    await page.goto('/workstreams/data-observatory')
    const row = page.locator('.partner-plate').first()
    await expect(row.getByText('Delivered with')).toBeVisible()
    await expect(row.getByRole('img', { name: /DATAMIND/ })).toBeVisible()
  })

  test('workstream delivery institutions stay as text, with no logo hierarchy', async ({
    page,
  }) => {
    // Deliberate: a workstream's institutions are co-equal and we hold cleared
    // artwork for only one, so showing one logo would invent a hierarchy.
    await page.goto('/workstreams/multi-omics')
    const deliveredBy = page
      .locator('article')
      .getByText('Delivered by', { exact: true })
      .locator('xpath=ancestor::div[1]')
    await expect(deliveredBy.getByText('Cardiff University')).toBeVisible()
    await expect(deliveredBy.getByRole('img')).toHaveCount(0)
  })
})
