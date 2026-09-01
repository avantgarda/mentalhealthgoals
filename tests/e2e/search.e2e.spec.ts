import { test, expect } from '@playwright/test'

/**
 * Site search covers pages, workstreams, news and people, and matches on body
 * text as well as titles. Each case below returned nothing before that: the
 * index held posts alone, and stored only titles and meta descriptions.
 */
test.describe('Search', () => {
  test('keeps a query arrived at from a link', async ({ page }) => {
    await page.goto('/search?q=workstream')
    // The box used to clear itself on mount and rewrite the URL to /search.
    await expect(page).toHaveURL(/\/search\?q=workstream/)
    await expect(page.locator('#search')).toHaveValue('workstream')
    await expect(page.getByRole('status')).toContainText(/results for/i)
  })

  test('ranks a title match above a body match', async ({ page }) => {
    await page.goto('/search?q=workstream')
    await expect(page.locator('article h2').first()).toContainText('Workstreams')
  })

  test('finds workstreams, people and pages, not just posts', async ({ page }) => {
    await page.goto('/search?q=Mehta')
    const person = page.locator('article', { hasText: 'Mehta' }).first()
    await expect(person).toContainText('Person')
    await expect(person.locator('a[href="/people#mitul-mehta"]')).toBeVisible()

    await page.goto('/search?q=DIGIT')
    await expect(page.locator('article').first()).toBeVisible()

    await page.goto('/search?q=accessibility')
    await expect(page.locator('a[href="/accessibility"]').first()).toBeVisible()
  })

  test('matches text from the middle of a page, not just its title', async ({ page }) => {
    // "SWOT" appears only in the Forum page's event-details block.
    await page.goto('/search?q=SWOT')
    await expect(page.locator('a[href="/industry-engagement-forum"]').first()).toBeVisible()
  })

  test('says so when there is nothing, and prompts when nothing is typed', async ({ page }) => {
    await page.goto('/search?q=zzzznothing')
    await expect(page.getByRole('status')).toContainText(/no results/i)

    await page.goto('/search')
    await expect(page.getByText(/start typing/i)).toBeVisible()
    await expect(page.locator('article')).toHaveCount(0)
  })

  test('typing updates the query without filling the history stack', async ({ page }) => {
    await page.goto('/search')
    const before = await page.evaluate(() => history.length)
    await page.locator('#search').fill('psychiatry')
    await expect(page).toHaveURL(/q=psychiatry/)
    // router.replace, not push — otherwise Back walks out one letter at a time.
    expect(await page.evaluate(() => history.length)).toBe(before)
  })

  test('a person result lands on their card', async ({ page }) => {
    await page.goto('/search?q=Mehta')
    await page.locator('a[href="/people#mitul-mehta"]').first().click()
    await page.waitForURL(/\/people#mitul-mehta/)
    await expect(page.locator('#mitul-mehta')).toBeVisible()
  })
})
