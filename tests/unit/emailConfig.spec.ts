import { describe, expect, it } from 'vitest'

import { shouldSendRealEmail } from '@/utilities/emailConfig'

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
