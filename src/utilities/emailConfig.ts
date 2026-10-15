import type { EmailAdapter, SendEmailOptions } from 'payload'

import { resendAdapter } from '@payloadcms/email-resend'

import type { EmailAudience } from './emailTemplate'
import { createAuthEmailAdapter, type AuthEmailEnvironment } from './authEmailAdapter'

/** Form mail retains its audience override; unmarked mail uses the stricter auth policy. */
export type EmailEnvironment = AuthEmailEnvironment & {
  EMAIL_OVERRIDE_RECIPIENT?: string
}

export const shouldSendRealEmail = (
  env: EmailEnvironment,
): { send: false } | { send: true; overrideRecipientAddress?: string } => {
  if (!env.RESEND_API_KEY) return { send: false }

  const overrideRecipientAddress =
    env.VERCEL_ENV === 'production' ? undefined : env.EMAIL_OVERRIDE_RECIPIENT?.trim() || undefined
  const isNonProductionDeploy = Boolean(env.VERCEL_ENV) && env.VERCEL_ENV !== 'production'

  if (isNonProductionDeploy && !overrideRecipientAddress) return { send: false }

  return { send: true, overrideRecipientAddress }
}

/**
 * Who a form email is for, as a header on the message: 'person' for the copy
 * sent to the address typed into the form, 'team' for the notification. The
 * form hook sets it; the adapter uses it to separate form mail from account
 * mail. Unmarked messages always use the stricter account-email policy.
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

/** Always install auth handling: disabled delivery must never look like success. */
export const emailConfig = (env: EmailEnvironment = process.env): { email: EmailAdapter } => ({
  email: (args) => {
    const auth = createAuthEmailAdapter(env)(args)
    const decision = shouldSendRealEmail(env)
    const form = resendAdapter({
      apiKey: env.RESEND_API_KEY || '',
      defaultFromAddress: 'noreply@mentalhealthgoals.co.uk',
      defaultFromName: 'Mental Health Goals Programme',
    })(args)
    return {
      ...auth,
      sendEmail: (message) => {
        const headers = message.headers
        const audience = Array.isArray(headers)
          ? headers.find((h) => h.key.toLowerCase() === AUDIENCE_HEADER.toLowerCase())?.value
          : Object.entries(headers || {}).find(
              ([key]) => key.toLowerCase() === AUDIENCE_HEADER.toLowerCase(),
            )?.[1]
        // Only our form hook marks messages. Payload password emails are unmarked.
        if (audience !== 'team' && audience !== 'person') return auth.sendEmail(message)
        if (!decision.send) {
          args.payload.logger.info('Form email delivery disabled; message body omitted.')
          return Promise.resolve()
        }
        return form.sendEmail(
          decision.overrideRecipientAddress
            ? redirectTo(message, decision.overrideRecipientAddress)
            : message,
        )
      },
    }
  },
})
