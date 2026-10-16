import { test, expect } from '@playwright/test'
import { E2E_BASE_URL } from '../../playwright.config'
import { FIXTURE } from '../fixtures/site'
import { link, paragraph, root } from '../fixtures/lexical'
import { change, relinkToMedia } from '../../scripts/lib/content-plan'
import { assessChange } from '../../scripts/lib/content-patch-core'

// Exercise the junction between account hardening and content:run: an active
// editor's JWT must still support multipart upload, exact read-back and editing.
test('an active editor can upload and link a PDF using the content-script auth flow', async ({
  request,
  playwright,
}) => {
  test.setTimeout(120_000)
  const adminLogin = await request.post('/api/users/login', { data: FIXTURE.admin })
  expect(adminLogin.ok()).toBe(true)
  const adminHeaders = { Authorization: `JWT ${(await adminLogin.json()).token}` }
  const suffix = Date.now()
  const credentials = {
    email: `content-editor-${suffix}@example.test`,
    password: 'Local-test-only-password-47!',
  }
  const created = await request.post('/api/users', {
    headers: adminHeaders,
    data: { ...credentials, name: 'Content script QA', role: 'editor' },
  })
  expect(created.status()).toBe(201)
  const user = (await created.json()).doc
  const login = await request.post('/api/users/login', { data: credentials })
  expect(login.ok()).toBe(true)
  // Fresh context: JWT only, no browser session cookies, just like cms-client.ts.
  const editor = await playwright.request.newContext({
    baseURL: E2E_BASE_URL,
    extraHTTPHeaders: { Authorization: `JWT ${(await login.json()).token}` },
  })
  let mediaID: number | undefined
  let postID: number | undefined
  try {
    expect(user.invitationPending).toBe(false)
    const users = await editor.get('/api/users')
    expect((await users.json()).docs.map((doc: { id: number }) => doc.id)).toEqual([user.id])
    const source = await request.get(`/api/media/file/${FIXTURE.forum.slides.filename}`)
    expect(source.ok()).toBe(true)
    const bytes = await source.body()
    const upload = await editor.post('/api/media', {
      multipart: {
        file: { name: `editor-upload-${suffix}.pdf`, mimeType: 'application/pdf', buffer: bytes },
        _payload: JSON.stringify({ alt: 'Content script PDF test' }),
      },
    })
    expect(upload.status()).toBe(201)
    const file = (await upload.json()).doc
    mediaID = file.id
    const downloaded = await editor.get(`/api/media/file/${file.filename}`)
    expect(downloaded.status()).toBe(200)
    expect(await downloaded.body()).toEqual(bytes)
    const postResponse = await editor.post('/api/posts?draft=true', {
      data: {
        title: `Editor upload ${suffix}`,
        slug: `editor-upload-${suffix}`,
        content: root(paragraph(link('Test slides', `/api/media/file/${file.filename}`))),
      },
    })
    expect(postResponse.status()).toBe(201)
    postID = (await postResponse.json()).doc.id
    const read = async () =>
      await (await editor.get(`/api/posts/${postID}?depth=0&draft=true`)).json()
    const baseline = await read()
    const content = structuredClone(baseline.content)
    expect(relinkToMedia(content, { media: [file] })).toEqual([file.filename])
    const planned = change('posts', baseline, { content })
    const patched = await editor.patch(`/api/posts/${postID}?depth=0&draft=true`, {
      data: planned.after,
    })
    expect(patched.ok()).toBe(true)
    expect(assessChange(await read(), planned)).toBe('already applied')
    expect((await editor.post('/api/users/logout')).ok()).toBe(true)
    expect((await editor.get('/api/users')).status()).toBe(403)
  } finally {
    await editor.dispose()
    if (postID) await request.delete(`/api/posts/${postID}`, { headers: adminHeaders })
    if (mediaID) await request.delete(`/api/media/${mediaID}`, { headers: adminHeaders })
    await request.delete(`/api/users/${user.id}`, { headers: adminHeaders })
  }
})

test('the configured auth origin keeps local images optimisable', async ({ page }) => {
  await page.goto('/industry-engagement-forum')
  const image = page.locator('img[src*="fixture-card"]').first()
  await image.scrollIntoViewIfNeeded()
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBeGreaterThan(0)
  const source = new URL((await image.getAttribute('src'))!, E2E_BASE_URL)
  expect(source.searchParams.get('url')).toMatch(/^\/api\/media\/file\/fixture-card\.png/)
})
