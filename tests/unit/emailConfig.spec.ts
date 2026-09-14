import type { EmailAdapter, SendEmailOptions } from 'payload'
import { describe, expect, it } from 'vitest'

import {
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
