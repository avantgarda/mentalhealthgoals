import { resendAdapter } from '@payloadcms/email-resend'
import type { EmailAdapter } from 'payload'

export type AuthEmailEnvironment = {
  VERCEL_ENV?: string
  RESEND_API_KEY?: string
  PAYLOAD_AUTH_EMAIL_TEST_TO?: string
}

export class AuthEmailDisabledError extends Error {
  constructor() {
    super(
      'Account email sending is disabled. Ask the site administrator to configure email delivery, then request a new link.',
    )
    this.name = 'AuthEmailDisabledError'
  }
}

export const createAuthEmailAdapter =
  (env: AuthEmailEnvironment = process.env): EmailAdapter =>
  (args) => {
    const recipient = env.PAYLOAD_AUTH_EMAIL_TEST_TO?.trim()
    const production = env.VERCEL_ENV === 'production'
    const adapter = resendAdapter({
      defaultFromAddress: 'noreply@mentalhealthgoals.co.uk',
      defaultFromName: 'Mental Health Goals Programme',
      apiKey: env.RESEND_API_KEY || '',
    })(args)
    return {
      ...adapter,
      sendEmail: async (message) => {
        if (!env.RESEND_API_KEY || (!production && !recipient)) throw new AuthEmailDisabledError()
        // Auth links never go to a general form-test mailbox. Drop cc/bcc too.
        const outgoing = production
          ? message
          : { ...message, to: recipient!, cc: undefined, bcc: undefined }
        try {
          return await adapter.sendEmail(outgoing)
        } catch {
          // Provider error bodies may contain the reset URL. Keep it out of logs and API responses.
          throw new Error('Account email could not be sent. Please request a new link later.')
        }
      },
    }
  }
