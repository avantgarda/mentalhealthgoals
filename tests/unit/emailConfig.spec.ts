import type { EmailAdapter, SendEmailOptions } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  emailConfig,
  AUDIENCE_HEADER,
  redirectTo,
  shouldSendRealEmail,
  withRecipientOverride,
} from '@/utilities/emailConfig'

/**
 * Who a non-production environment is allowed to email.
 *
 * The hazard this guards is not obvious from the code it protects: the contact
 * form's recipient is stored on the form document, so it arrives with the
 * database. A preview runs on a branch of production's, and a developer who has
 * synced production has its rows locally — so "which environment am I?" says
 * nothing about who a message would reach.
 */
describe('shouldSendRealEmail', () => {
  it('writes to the console when there is no API key', () => {
    expect(shouldSendRealEmail({})).toEqual({ send: false })
    expect(shouldSendRealEmail({ EMAIL_OVERRIDE_RECIPIENT: 'dev@example.com' })).toEqual({
      send: false,
    })
  })

  it('sends normally in production', () => {
    expect(shouldSendRealEmail({ RESEND_API_KEY: 'k', VERCEL_ENV: 'production' })).toEqual({
      send: true,
      overrideRecipientAddress: undefined,
    })
  })

  it('refuses to send from a preview that has named no override', () => {
    // Fail-closed: a preview runs unattended against real recipients, and
    // forgetting the variable must not be how we find that out.
    expect(shouldSendRealEmail({ RESEND_API_KEY: 'k', VERCEL_ENV: 'preview' })).toEqual({
      send: false,
    })
    expect(
      shouldSendRealEmail({
        RESEND_API_KEY: 'k',
        VERCEL_ENV: 'preview',
        EMAIL_OVERRIDE_RECIPIENT: '  ',
      }),
    ).toEqual({ send: false })
  })

  it('redirects every message when a preview names an override', () => {
    expect(
      shouldSendRealEmail({
        RESEND_API_KEY: 'k',
        VERCEL_ENV: 'preview',
        EMAIL_OVERRIDE_RECIPIENT: 'dev@example.com',
      }),
    ).toEqual({ send: true, overrideRecipientAddress: 'dev@example.com' })
  })

  it('never infers production from a missing VERCEL_ENV', () => {
    // The check identifies what is definitely NOT production. Reading it the
    // other way round would mean a renamed or absent variable silently stopped
    // production sending, which is the worse failure.
    expect(shouldSendRealEmail({ RESEND_API_KEY: 'k' })).toEqual({
      send: true,
      overrideRecipientAddress: undefined,
    })
  })

  it('lets a laptop redirect its own mail', () => {
    expect(
      shouldSendRealEmail({ RESEND_API_KEY: 'k', EMAIL_OVERRIDE_RECIPIENT: 'dev@example.com' }),
    ).toEqual({ send: true, overrideRecipientAddress: 'dev@example.com' })
  })
})

/**
 * What the override does to each message once it is on. The team's copy and
 * anything unmarked are redirected; the person's own copy is not, because the
 * only address in it is the one they typed.
 */
describe('redirectTo', () => {
  const team: SendEmailOptions = {
    to: 'team@example.org',
    cc: 'boss@example.org',
    bcc: 'archive@example.org',
    subject: 'New enquiry',
    html: '<p>x</p>',
    headers: { [AUDIENCE_HEADER]: 'team' },
  }
  const person: SendEmailOptions = {
    to: 'ada@example.org',
    subject: 'Your enquiry',
    html: '<p>x</p>',
    headers: { [AUDIENCE_HEADER]: 'person' },
  }
  const reset: SendEmailOptions = { to: 'editor@example.org', subject: 'Reset', html: '<p>x</p>' }

  it('sends the team’s copy to the override, dropping cc and bcc', () => {
    expect(redirectTo(team, 'dev@example.com')).toEqual({
      ...team,
      to: 'dev@example.com',
      cc: undefined,
      bcc: undefined,
    })
  })

  it('treats a message that carries no audience as the team’s', () => {
    expect(redirectTo(reset, 'dev@example.com').to).toBe('dev@example.com')
  })

  it('leaves the person’s own copy addressed to them', () => {
    expect(redirectTo(person, 'dev@example.com')).toBe(person)
  })

  it('reads the header in the list shape too', () => {
    const listed = { ...person, headers: [{ key: 'x-mhg-audience', value: 'person' }] }
    expect(redirectTo(listed, 'dev@example.com').to).toBe('ada@example.org')
  })

  it('wraps an adapter so every message goes through the redirect', async () => {
    const sent: SendEmailOptions[] = []
    const fake: EmailAdapter<void> = () => ({
      name: 'fake',
      defaultFromAddress: 'noreply@example.org',
      defaultFromName: 'Example',
      sendEmail: async (message) => {
        sent.push(message)
      },
    })
    const adapter = withRecipientOverride(fake, 'dev@example.com')({ payload: {} as never })
    await adapter.sendEmail(team)
    await adapter.sendEmail(person)
    await adapter.sendEmail(reset)
    expect(sent.map((m) => m.to)).toEqual(['dev@example.com', 'ada@example.org', 'dev@example.com'])
    expect(adapter.name).toBe('fake')
  })
})

afterEach(() => vi.unstubAllGlobals())
describe('account and form email isolation', () => {
  const make = (env: Parameters<typeof emailConfig>[0]) =>
    emailConfig(env).email({ payload: { logger: { info: vi.fn() } } as never })
  const message = {
    to: 'staff@example.test',
    cc: 'other@example.test',
    bcc: 'hidden@example.test',
    subject: 'Test',
    html: '<p>Secret</p>',
  }
  it('requires an auth mailbox even when a general form override is configured', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(
      make({ RESEND_API_KEY: 'test', EMAIL_OVERRIDE_RECIPIENT: 'forms@example.test' }).sendEmail(
        message,
      ),
    ).rejects.toThrow(/disabled/)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('never reports auth success without a provider key, including production', async () => {
    await expect(make({ VERCEL_ENV: 'production' }).sendEmail(message)).rejects.toThrow(/disabled/)
    await expect(
      make({ PAYLOAD_AUTH_EMAIL_TEST_TO: 'auth@example.test' }).sendEmail(message),
    ).rejects.toThrow(/disabled/)
  })
  it('routes auth and team mail separately and preserves form replies', async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() => Promise.resolve(Response.json({ id: 'test-id' })))
    vi.stubGlobal('fetch', fetcher)
    const adapter = make({
      VERCEL_ENV: 'preview',
      RESEND_API_KEY: 'test',
      EMAIL_OVERRIDE_RECIPIENT: 'forms@example.test',
      PAYLOAD_AUTH_EMAIL_TEST_TO: 'auth@example.test',
    })
    await adapter.sendEmail(message)
    await adapter.sendEmail({ ...message, headers: { [AUDIENCE_HEADER]: 'team' } })
    await adapter.sendEmail({
      ...message,
      cc: undefined,
      bcc: undefined,
      headers: { [AUDIENCE_HEADER]: 'person' },
    })
    const sent = fetcher.mock.calls.map((call) => JSON.parse(call[1].body))
    expect(sent.map((m) => m.to)).toEqual([
      'auth@example.test',
      'forms@example.test',
      'staff@example.test',
    ])
    expect(sent[0].cc).toBe('')
    expect(sent[0].bcc).toBe('')
  })
  it('ignores both test overrides in production', async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() => Promise.resolve(Response.json({ id: 'test-id' })))
    vi.stubGlobal('fetch', fetcher)
    const adapter = make({
      VERCEL_ENV: 'production',
      RESEND_API_KEY: 'test',
      EMAIL_OVERRIDE_RECIPIENT: 'forms@example.test',
      PAYLOAD_AUTH_EMAIL_TEST_TO: 'auth@example.test',
    })
    await adapter.sendEmail(message)
    await adapter.sendEmail({ ...message, headers: { [AUDIENCE_HEADER]: 'team' } })
    expect(fetcher.mock.calls.map((call) => JSON.parse(call[1].body).to)).toEqual([
      'staff@example.test',
      'staff@example.test',
    ])
  })
  it('does not expose provider response bodies in account email errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('sensitive-token', { status: 500 })),
    )
    await expect(
      make({ VERCEL_ENV: 'production', RESEND_API_KEY: 'test' }).sendEmail(message),
    ).rejects.toThrow('Account email could not be sent.')
  })
})
