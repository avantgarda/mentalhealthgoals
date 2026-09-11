/**
 * Brand every email a form sends.
 *
 * The form builder hands over each message after the editor's template has
 * been filled in; this wraps it in the programme's frame (see emailTemplate)
 * with the lockup the site is currently using, then hands it back. Branding is
 * cosmetic and the message is not, so if the frame cannot be built for any
 * reason the message goes out plain rather than not at all.
 */
import type { BeforeEmail, FormattedEmail } from '@payloadcms/plugin-form-builder/types'

import { DEFAULT_LOGO_VARIANT } from '@/brand/marks'

import { brandedEmailHtml, emailText } from './emailTemplate'
import { getServerSideURL } from './getURL'

/**
 * Where the lockup image is fetched from — deliberately not the site's own URL.
 * An email is opened long after it is sent, from any client, so its images need
 * a host that is public today and stays so: the custom domain is parked until
 * launch, and per-deployment URLs sit behind SSO. The project's `vercel.app`
 * alias is public, permanent, and serves the same `public/brand` files.
 */
export const EMAIL_ASSET_ORIGIN = 'https://mentalhealthgoals.vercel.app'

export type EmailBrand = {
  logoVariant: string
  programmeName: string
  siteUrl: string
}

export function brandFormEmails(emails: FormattedEmail[], brand: EmailBrand): FormattedEmail[] {
  return emails.map((email) => {
    const html = brandedEmailHtml({
      body: email.html,
      logoUrl: `${EMAIL_ASSET_ORIGIN}/brand/${brand.logoVariant}/lockup-email.png`,
      siteUrl: brand.siteUrl,
      programmeName: brand.programmeName,
    })
    // The plugin's type has no plain-text part, but Payload's sendEmail takes
    // one and Resend forwards it — for clients that prefer it and filters that
    // distrust HTML-only mail.
    return { ...email, html, text: emailText(html) } as FormattedEmail
  })
}

export const beforeEmail: BeforeEmail = async (emails, { req }) => {
  try {
    const [brand, details] = await Promise.all([
      req.payload.findGlobal({ slug: 'brand', depth: 0, req }),
      req.payload.findGlobal({ slug: 'programmeDetails', depth: 0, req }),
    ])
    return brandFormEmails(emails, {
      logoVariant: brand.logoVariant || DEFAULT_LOGO_VARIANT,
      programmeName: details.name || 'Mental Health Goals Programme',
      siteUrl: getServerSideURL(),
    })
  } catch (error) {
    req.payload.logger.warn({ err: error, msg: 'Form email sent without the branded frame' })
    return emails
  }
}
