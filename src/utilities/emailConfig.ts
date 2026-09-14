import type { EmailAdapter, SendEmailOptions } from 'payload'

import { resendAdapter } from '@payloadcms/email-resend'

import type { EmailAudience } from './emailTemplate'

/**
 * Resend, with a safety rule about who non-production environments may email.
 *
 * Recipients are not an environment setting. The contact form's notification
 * address is stored on the form document, so it travels with the database — a
 * preview deployment runs on a branch of production's, and a developer who has
 * run `pnpm sync:db` has production's rows on their laptop. Pointing a
 * non-production environment at a different address therefore has to happen at
 * the point of sending, which is what the override below does: every message
 * goes there instead, whatever the CMS says — the team's notification, a
 * password reset, anything.
 *
 * With one exception. A form's reply to the person who filled it in goes where
 * they said. A tester types their own address and reads the same email a
 * visitor would, and no address but their own is in that message; the team
 * inbox is the one that must not fill up with tests. The form hook marks that
 * message with AUDIENCE_HEADER, and the override lets it through.
 *
 * On a preview deployment the rule is fail-closed: with no override address, no
 * adapter is attached and mail goes to the server log instead. A preview runs
 * unattended against real recipients, and "we forgot to set the variable" is
 * not an acceptable way to discover that.
 *
 * Locally the developer decides. Set EMAIL_OVERRIDE_RECIPIENT to watch real
 * mail arrive, or leave RESEND_API_KEY unset and read it in the console.
 *
 * VERCEL_ENV is only ever consulted to identify a deployment that is definitely
 * NOT production. It is never used to conclude that something IS production, so
 * an absent or renamed value cannot silently stop production sending.
 */
export type EmailEnvironment = {
  RESEND_API_KEY?: string
  EMAIL_OVERRIDE_RECIPIENT?: string
  VERCEL_ENV?: string
}

export const shouldSendRealEmail = (
  env: EmailEnvironment,
): { send: false } | { send: true; overrideRecipientAddress?: string } => {
  if (!env.RESEND_API_KEY) return { send: false }

  const overrideRecipientAddress = env.EMAIL_OVERRIDE_RECIPIENT?.trim() || undefined
  const isNonProductionDeploy = Boolean(env.VERCEL_ENV) && env.VERCEL_ENV !== 'production'

  if (isNonProductionDeploy && !overrideRecipientAddress) return { send: false }

  return { send: true, overrideRecipientAddress }
}

/**
 * Who a form email is for, as a header on the message: 'person' for the copy
 * sent to the address typed into the form, 'team' for the notification. The
 * form hook sets it; the override reads it. Anything without it — a password
 * reset, say — is treated as the team's.
 */
export const AUDIENCE_HEADER = 'X-MHG-Audience'

export const audienceOf = (message: SendEmailOptions): EmailAudience => {
  const { headers } = message
  const value = Array.isArray(headers)
    ? headers.find((h) => h.key.toLowerCase() === AUDIENCE_HEADER.toLowerCase())?.value
    : headers?.[AUDIENCE_HEADER]
  return value === 'person' ? 'person' : 'team'
}

/**
 * Everything but a person's own copy goes to `address` instead. Cc and bcc are
 * dropped rather than redirected: left alone they would still reach whoever
 * the CMS named.
 */
export const redirectTo = (message: SendEmailOptions, address: string): SendEmailOptions =>
  audienceOf(message) === 'person'
    ? message
    : { ...message, to: address, cc: undefined, bcc: undefined }

/** The adapter as given, with every message passed through `redirectTo`. */
export const withRecipientOverride =
  <T>(adapter: EmailAdapter<T>, address: string): EmailAdapter<T> =>
  (args) => {
    const initialised = adapter(args)
    return {
      ...initialised,
      sendEmail: (message) => initialised.sendEmail(redirectTo(message, address)),
    }
  }

/** Spread into the Payload config. Empty means "write emails to the console". */
export const emailConfig = (env: EmailEnvironment = process.env) => {
  const decision = shouldSendRealEmail(env)
  if (!decision.send) return {}

  const adapter = resendAdapter({
    apiKey: env.RESEND_API_KEY!,
    defaultFromAddress: 'noreply@mentalhealthgoals.co.uk',
    defaultFromName: 'Mental Health Goals Programme',
  })

  return {
    email: decision.overrideRecipientAddress
      ? withRecipientOverride(adapter, decision.overrideRecipientAddress)
      : adapter,
  }
}
