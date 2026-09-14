/**
 * The branded frame around every email the site sends from a form.
 *
 * Editors write the message in the CMS; this wraps it in a header carrying the
 * programme's lockup, a footer with the site and privacy links, and enough
 * inline styling to look the same in Gmail, Outlook and Apple Mail. Email
 * clients ignore web fonts and, in Gmail's case, often the stylesheet too, so
 * the styles are pushed inline onto the message's own tags and the type falls
 * back to the system stacks the brand already names.
 *
 * Pure: takes strings, returns a string, so it can be tested without Payload.
 */
import { BRAND_COLORS } from '../brand/tokens'

/**
 * The lockup as displayed in the header — the website header's own size.
 * `generate:email-lockup` photographs every variant onto this canvas at twice
 * this width, so it stays sharp on high-density screens. The template sets
 * only the width; the image's own proportions decide the height, so a
 * regenerated lockup never gets squashed into last year's box.
 */
export const EMAIL_LOCKUP = { width: 236, height: 34 }

/** Who is reading: the person who filled in the form, or the team it notifies.
 * The frame is the same; the footer's explanation of why they got it is not. */
export type EmailAudience = 'person' | 'team'

export type BrandedEmailInput = {
  /** The message HTML the form builder produced — trusted, already serialised. */
  body: string
  /** Absolute URL of a raster lockup; SVG does not render in Gmail or Outlook. */
  logoUrl: string
  /** Where the site is; the footer names its host and links the privacy notice. */
  siteUrl: string
  programmeName: string
  audience?: EmailAudience
}

const SANS = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif"
const SERIF = "Fraunces, 'Iowan Old Style', 'Palatino Nova', Georgia, serif"
const RULE = '#E6E2DA'
const MUTED = '#5F6B6E'

const NOTICE: Record<EmailAudience, string> = {
  person: 'You are receiving this email because you submitted a form on our website.',
  team: 'Sent automatically by the website’s forms to the programme team.',
}

export const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Inline styles onto the bare tags the form builder emits: `<p>`, headings,
 * lists, links, and the `<table><tr><td>key</td><td>value</td>` it renders for
 * `{{*:table}}`. Only tags without attributes are touched, so anything an
 * editor styled deliberately is left alone.
 */
export function styleMessage(body: string): string {
  const heading = (size: number) =>
    `margin:0 0 12px;font-family:${SERIF};font-size:${size}px;font-weight:600;line-height:1.25;color:${BRAND_COLORS.ink};`
  return body
    .replace(/<table>[\s\S]*?<\/table>/g, styleTable)
    .replace(/<p>/g, '<p style="margin:0 0 16px;">')
    .replace(/<h1>/g, `<h1 style="${heading(22)}">`)
    .replace(/<h2>/g, `<h2 style="${heading(19)}">`)
    .replace(/<h3>/g, `<h3 style="${heading(17)}">`)
    .replace(/<h4>/g, `<h4 style="${heading(15)}">`)
    .replace(/<(ul|ol)>/g, '<$1 style="margin:0 0 16px;padding-left:22px;">')
    .replace(/<a href=/g, `<a style="color:${BRAND_COLORS.petrol};" href=`)
}

/** The width the message sits in: the 600px card less its 40px side padding. */
export const CONTENT_WIDTH = 520
/**
 * What a character of a 13px semibold label costs in the frame's font stack.
 * Email clients have no Inter, so this is Helvetica: 7.2–7.8px per character
 * at 15px across the forms' labels, measured in Chrome, scaled to 13px.
 * Estimates, so widths carry slack.
 */
const LABEL_CHAR_PX = 6.6
/** Left plus right cell padding. */
const CELL_PADDING = 16
/** The most of the table a label column may take; the answers keep the rest. */
const LABEL_MAX_SHARE = 0.4

/**
 * The label column, sized from the labels themselves: wide enough to hold the
 * longest on one line, up to two-fifths of the table. Beyond that a label
 * wraps — the answers are what the reader is there for, and a consent
 * sentence held on one line once squeezed them into a sliver.
 */
export function labelColumnWidth(labels: string[]): number {
  const longest = Math.max(0, ...labels.map((label) => label.length))
  const fits = Math.ceil(longest * LABEL_CHAR_PX * 1.06) + CELL_PADDING
  return Math.min(fits, Math.round(CONTENT_WIDTH * LABEL_MAX_SHARE))
}

const visibleText = (html: string): string =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(
      /&(amp|lt|gt|quot|#39);/g,
      (_, e: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e] ?? '',
    )

/** A two-column key–value table, as the plugin and the form hook emit it. */
function styleTable(table: string): string {
  const cell = `text-align:left;vertical-align:top;padding:6px 8px;border-bottom:1px solid ${RULE};font-size:13px;`
  const labels = [...table.matchAll(/<tr><td>(.*?)<\/td>/g)].map((m) => visibleText(m[1]))
  const width = labelColumnWidth(labels)
  return table
    .replace(
      /<table>/,
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;margin:0 0 16px;">',
    )
    .replace(
      /<tr><td>/g,
      `<tr><td width="${width}" style="${cell}width:${width}px;color:${MUTED};font-weight:600;">`,
    )
    .replace(/<\/td><td>/g, `</td><td style="${cell}">`)
}

export function brandedEmailHtml(input: BrandedEmailInput): string {
  const name = escapeHtml(input.programmeName)
  const site = input.siteUrl.replace(/\/$/, '')
  const host = escapeHtml(new URL(site).host)
  const notice = NOTICE[input.audience ?? 'person']
  const text = `font-family:${SANS};font-size:14px;line-height:1.55;color:${BRAND_COLORS.ink};`
  const small = `font-family:${SANS};font-size:11px;line-height:1.5;color:${MUTED};`
  const link = `color:${BRAND_COLORS.petrol};text-decoration:underline;`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${name}</title>
</head>
<body style="margin:0;padding:0;background:#F3F1EC;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F1EC;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#FFFFFF;border-top:4px solid ${BRAND_COLORS.amber};">
        <tr>
          <td style="padding:28px 40px 22px;border-bottom:1px solid ${RULE};">
            <a href="${escapeHtml(site)}" style="text-decoration:none;">
              <img src="${escapeHtml(input.logoUrl)}" width="${EMAIL_LOCKUP.width}" alt="${name}" style="display:block;border:0;outline:none;max-width:100%;height:auto;">
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px 12px;${text}">
${styleMessage(input.body)}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid ${RULE};${small}">
            <p style="margin:0 0 6px;">${name} &middot; <a href="${escapeHtml(site)}" style="${link}">${host}</a> &middot; <a href="${escapeHtml(site)}/privacy" style="${link}">Privacy notice</a></p>
            <p style="margin:0;">${notice}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

/** A plain-text rendering for clients that ask for one, and for spam filters
 * that distrust HTML-only mail. Tags out, entities back, whitespace collapsed. */
export function emailText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|tr|h[1-6]|li|div)>/gi, '\n')
    .replace(/<\/td>/gi, '  ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
