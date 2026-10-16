import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { createAuthEmailAdapter } from '@/utilities/authEmailAdapter'
import { passwordEmail } from '@/collections/Users/passwordEmail'

const request = (serverURL = 'https://www.mentalhealthgoals.co.uk') =>
  ({
    payload: {
      config: { serverURL, routes: { admin: '/admin' }, admin: { routes: { reset: '/reset' } } },
    },
  }) as unknown as PayloadRequest
const adapter = () => createAuthEmailAdapter()({ payload: {} as Payload })
const message = { to: 'real-user@example.test', subject: 'Reset', html: '<p>Secret link</p>' }
beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 'test-only-key')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('auth email safety and templates', () => {
  it('blocks local and preview email without an explicit test recipient', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    vi.stubEnv('PAYLOAD_AUTH_EMAIL_TEST_TO', '')
    for (const environment of ['', 'development', 'preview']) {
      vi.stubEnv('VERCEL_ENV', environment)
      await expect(adapter().sendEmail(message)).rejects.toThrow(/disabled/)
    }
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('redirects all nonproduction auth email to the configured test recipient', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('PAYLOAD_AUTH_EMAIL_TEST_TO', 'qa@example.test')
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: 'test-id' }))
    vi.stubGlobal('fetch', fetcher)
    await adapter().sendEmail(message)
    expect(JSON.parse(fetcher.mock.calls[0][1].body).to).toBe('qa@example.test')
  })
  it('uses the actual recipient in production even if a test recipient exists', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('PAYLOAD_AUTH_EMAIL_TEST_TO', 'qa@example.test')
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: 'test-id' }))
    vi.stubGlobal('fetch', fetcher)
    await adapter().sendEmail(message)
    expect(JSON.parse(fetcher.mock.calls[0][1].body).to).toBe('real-user@example.test')
  })
  it('propagates provider failures instead of reporting success', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ message: 'Rejected' }, { status: 403 })),
    )
    await expect(adapter().sendEmail(message)).rejects.toThrow()
  })
  it('escapes names, encodes tokens and uses the configured host', () => {
    const html = passwordEmail({
      req: request(),
      token: 'a/b?c',
      user: { name: '<img src=x>', invitationPending: true },
    })
    expect(html).toContain('&lt;img src=x&gt;')
    expect(html).toContain('https://www.mentalhealthgoals.co.uk/admin/reset/a%2Fb%3Fc')
    expect(html).toContain('Set your password')
    expect(html).toContain('one hour')
  })
  it('uses recovery wording for existing accounts and rejects insecure remote hosts', () => {
    expect(passwordEmail({ req: request(), token: 'test' })).toContain('Reset your password')
    expect(() => passwordEmail({ req: request('http://example.com'), token: 'test' })).toThrow(
      /secure/,
    )
    expect(() => passwordEmail()).toThrow()
  })
})
