import { expect, test } from '@playwright/test'

test.describe('Partner logos', () => {
  test('the accountability band names the funder and the delivery body on every page', async ({
    page,
  }) => {
    for (const path of ['/', '/about', '/search']) {
      await page.goto(path)
      const band = page.getByRole('region', { name: 'Funded and delivered by' })
      await expect(band).toBeVisible()
      await expect(band.getByRole('img', { name: /Office for Life Sciences/ })).toBeVisible()
      await expect(band.getByRole('img', { name: /Medical Research Council/ })).toBeVisible()
    }
  })

  test('the band names no delivery institution or team', async ({ page }) => {
    // Nine institutions deliver the programme. The band is the site's one
    // every-page claim, so naming one of them there would read as precedence
    // over the other eight — and DIGIT is a team within the programme rather
    // than a funder or delivery body.
    await page.goto('/')
    const band = page.getByRole('region', { name: 'Funded and delivered by' })
    await expect(band.getByRole('img', { name: /King’s College London/ })).toHaveCount(0)
    await expect(band.getByRole('link', { name: 'DIGIT' })).toHaveCount(0)
  })

  test('outbound partner links open in a new tab; internal ones do not', async ({ page }) => {
    await page.goto('/')
    const band = page.getByRole('region', { name: 'Funded and delivered by' })
    await expect(band.getByRole('link', { name: /Medical Research Council/ })).toHaveAttribute(
      'target',
      '_blank',
    )
    // The workstreams index links DIGIT to our own page — a new tab would be wrong.
    await page.goto('/workstreams')
    const digit = page.getByRole('link', { name: /About DIGIT/ })
    await expect(digit).toHaveAttribute('href', '/digit')
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
    const delivered = band.getByRole('list', { name: 'Delivered by' })
    await expect(delivered.getByRole('img', { name: /Medical Research Council/ })).toBeVisible()
    // Each group names its own list rather than relying on visual grouping.
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
