import { resendAdapter } from '@payloadcms/email-resend'

/**
 * Resend, with a safety rule about who non-production environments may email.
 *
 * Recipients are not an environment setting. The contact form's notification
 * address is stored on the form document, so it travels with the database — a
 * preview deployment runs on a branch of production's, and a developer who has
 * run `pnpm sync:db` has production's rows on their laptop. Pointing a
 * non-production environment at a different address therefore has to happen at
 * the point of sending, which is what `overrideRecipientAddress` does: every
 * message goes there instead, whatever the CMS says. It covers the contact
 * form's auto-reply and password resets too, not just the internal
 * notification.
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

/** Spread into the Payload config. Empty means "write emails to the console". */
export const emailConfig = (env: EmailEnvironment = process.env) => {
  const decision = shouldSendRealEmail(env)
  if (!decision.send) return {}

  return {
    email: resendAdapter({
      apiKey: env.RESEND_API_KEY!,
      defaultFromAddress: 'noreply@mentalhealthgoals.co.uk',
      defaultFromName: 'Mental Health Goals Programme',
      ...(decision.overrideRecipientAddress
        ? { overrideRecipientAddress: decision.overrideRecipientAddress }
        : {}),
    }),
  }
}
