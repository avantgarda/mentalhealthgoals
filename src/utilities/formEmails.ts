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
import type { SendEmailOptions } from 'payload'

import { DEFAULT_LOGO_VARIANT } from '@/brand/marks'
import type { Form } from '@/payload-types'

import { AUDIENCE_HEADER } from './emailConfig'
import { brandedEmailHtml, emailText, escapeHtml, type EmailAudience } from './emailTemplate'
import { getServerSideURL } from './getURL'

/**
 * Where the lockup image is fetched from — deliberately not the site's own URL.
 * An email is opened long after it is sent, from any client, so its images need
 * a host that is public today and stays so: the custom domain is parked until
 * launch, and per-deployment URLs sit behind SSO. The project's `vercel.app`
 * alias is public, permanent, and serves the same `public/brand` files.
 */
export const EMAIL_ASSET_ORIGIN = 'https://mentalhealthgoals.vercel.app'

/**
 * What the hook hands back: the plugin's shape plus two parts of Payload's
 * sendEmail options the plugin does not know about but forwards untouched —
 * the plain-text part, and the header that tells the recipient override who
 * the message is for.
 */
export type OutgoingFormEmail = FormattedEmail & Pick<SendEmailOptions, 'headers' | 'text'>

export type EmailBrand = {
  logoVariant: string
  programmeName: string
  siteUrl: string
}

/** Bare, lower-cased addresses from a To header: `Name <a@b>, c@d` → both. */
export function addresses(header: string): string[] {
  return header
    .split(',')
    .map((part) => (part.match(/<([^>]+)>/)?.[1] ?? part).trim().toLowerCase())
    .filter(Boolean)
}

export type SubmissionEntry = { field: string; value?: unknown }
/** The record in the CMS, for the team to open. */
export type SubmissionReference = { id: number | string; url: string }

const NOT_GIVEN = 'Not given'

/** `full-name` → `Full name`, for a field the form no longer defines. */
const humanise = (name: string): string => {
  const words = name
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase()
}

const multiline = (raw: string): string => escapeHtml(raw).replace(/\r?\n/g, '<br>')

type NamedField = Extract<NonNullable<Form['fields']>[number], { name: string }>

/** What a stored value means, read through the field that collected it. */
const display = (field: NamedField, raw: string): string => {
  switch (field.blockType) {
    case 'checkbox':
      return raw === 'true' ? 'Yes' : 'No'
    case 'select': {
      if (!raw) return NOT_GIVEN
      const option = field.options?.find((o) => o.value === raw)
      return escapeHtml(option?.label ?? raw)
    }
    default:
      return raw ? multiline(raw) : NOT_GIVEN
  }
}

/**
 * The submission as the team should read it: the form's own labels, the
 * option a person chose rather than its stored value, Yes or No for a box,
 * and a link to the record in the CMS. The plugin's `{{*:table}}` gives the
 * raw field names and values — `attendance: future`, `consent: on` — which
 * nobody outside the codebase can read. Rows follow the form's field order;
 * anything submitted that the form no longer defines is listed after them.
 */
export function submissionTable(
  fields: Form['fields'],
  entries: SubmissionEntry[],
  reference?: SubmissionReference,
): string {
  const values = new Map(entries.map((e) => [e.field, e.value == null ? '' : String(e.value)]))
  const rows: [string, string][] = []
  for (const field of fields ?? []) {
    if (!('name' in field) || !field.name) continue
    const raw = values.get(field.name) ?? ''
    values.delete(field.name)
    rows.push([field.label || humanise(field.name), display(field, raw)])
  }
  for (const [name, raw] of values) {
    // The plugin appends the record's id itself; the reference row covers it.
    if (name === 'formSubmissionID') continue
    rows.push([humanise(name), raw ? multiline(raw) : NOT_GIVEN])
  }
  if (reference) {
    rows.push([
      'Submission',
      `<a href="${escapeHtml(reference.url)}">#${escapeHtml(String(reference.id))}</a>`,
    ])
  }
  return `<table>${rows.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${v}</td></tr>`).join('')}</table>`
}

/**
 * A form sends to two kinds of reader: the person who filled it in, and the
 * team it notifies. The plugin does not say which is which, but the person's
 * address is in the submission and the team's is not — so an email whose
 * recipient was typed into the form is the person's copy. That answer also
 * goes out on the message as AUDIENCE_HEADER, so a non-production recipient
 * override can spare the person's copy and redirect only the team's.
 *
 * With a `table`, it stands in for every table the plugin rendered from
 * `{{*:table}}` — the message editor offers no tables of its own, so those
 * are the only ones there are.
 */
export function brandFormEmails(
  emails: FormattedEmail[],
  brand: EmailBrand,
  submittedAddresses: string[] = [],
  table?: string,
): OutgoingFormEmail[] {
  const submitted = new Set(submittedAddresses.map((a) => a.trim().toLowerCase()))
  return emails.map((email) => {
    const audience: EmailAudience = addresses(email.to).some((a) => submitted.has(a))
      ? 'person'
      : 'team'
    // A function, not a string: a replacement string reads `$&` and friends.
    const body = table ? email.html.replace(/<table>[\s\S]*?<\/table>/g, () => table) : email.html
    const html = brandedEmailHtml({
      body,
      logoUrl: `${EMAIL_ASSET_ORIGIN}/brand/${brand.logoVariant}/lockup-email.png`,
      siteUrl: brand.siteUrl,
      programmeName: brand.programmeName,
      audience,
    })
    // The plain-text part is for clients that prefer it and filters that
    // distrust HTML-only mail.
    return { ...email, html, text: emailText(html), headers: { [AUDIENCE_HEADER]: audience } }
  })
}

type HookParams = Parameters<BeforeEmail>[1]

/** What the hook reads from the plugin's arguments. It is called after the
 * submission is saved, so the record's id is there too, whatever the type says. */
type SubmissionParams = {
  data?: { form?: number | { id: number } | null; submissionData?: SubmissionEntry[] }
  doc?: { id?: number | string }
}

/** The labelled table, or nothing — in which case the plugin's own stays. */
async function tableFor(params: HookParams): Promise<string | undefined> {
  const { req } = params
  const { data, doc } = params as SubmissionParams
  try {
    const form = data?.form
    const formId = typeof form === 'object' && form ? form.id : form
    if (formId == null) return undefined
    const definition = await req.payload.findByID({
      collection: 'forms',
      id: formId,
      depth: 0,
      req,
    })
    const reference =
      doc?.id != null
        ? { id: doc.id, url: `${getServerSideURL()}/admin/collections/form-submissions/${doc.id}` }
        : undefined
    return submissionTable(definition.fields, data?.submissionData ?? [], reference)
  } catch (error) {
    req.payload.logger.warn({ err: error, msg: 'Form email sent with the plugin’s own table' })
    return undefined
  }
}

export const beforeEmail: BeforeEmail = async (emails, params) => {
  const { req } = params
  try {
    const [brand, details, table] = await Promise.all([
      req.payload.findGlobal({ slug: 'brand', depth: 0, req }),
      req.payload.findGlobal({ slug: 'programmeDetails', depth: 0, req }),
      tableFor(params),
    ])
    const submission = (params as SubmissionParams).data?.submissionData
    const submittedAddresses = (submission ?? [])
      .map((entry) => String(entry?.value ?? ''))
      .filter((value) => value.includes('@'))
    return brandFormEmails(
      emails,
      {
        logoVariant: brand.logoVariant || DEFAULT_LOGO_VARIANT,
        programmeName: details.name || 'Mental Health Goals Programme',
        siteUrl: getServerSideURL(),
      },
      submittedAddresses,
      table,
    )
  } catch (error) {
    // Unframed and unmarked: with an override set, both copies go to it.
    req.payload.logger.warn({ err: error, msg: 'Form email sent without the branded frame' })
    return emails
  }
}
