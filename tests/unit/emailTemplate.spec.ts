import { describe, expect, it, vi } from 'vitest'

import { brandedEmailHtml, emailText, styleMessage } from '@/utilities/emailTemplate'
import { EMAIL_ASSET_ORIGIN, beforeEmail, brandFormEmails } from '@/utilities/formEmails'

/**
 * The frame around form emails. What matters: the lockup and links are right,
 * the editor's message survives intact, the plugin's bare markup gets the
 * inline styles email clients need, and nothing here can stop an email.
 */
const body =
  '<div><p>Dear Ada,</p><p>Thank you for <a href="https://example.org">writing</a>.</p>' +
  '<table><tr><td>Full name</td><td>Ada &amp; Co</td></tr></table></div>'

const brand = {
  logoVariant: 'rings',
  programmeName: 'Mental Health Goals <Programme>',
  siteUrl: 'https://mentalhealthgoals.co.uk/',
}

describe('brandedEmailHtml', () => {
  const html = brandedEmailHtml({
    body,
    logoUrl: 'https://cdn.example/lockup-email.png',
    siteUrl: brand.siteUrl,
    programmeName: brand.programmeName,
  })

  it('puts the lockup in the header with its display size and an escaped alt', () => {
    expect(html).toContain(
      '<img src="https://cdn.example/lockup-email.png" width="340" height="63" alt="Mental Health Goals &lt;Programme&gt;"',
    )
  })

  it('links the site host and the privacy notice in the footer, without a trailing slash', () => {
    expect(html).toContain('href="https://mentalhealthgoals.co.uk"')
    expect(html).toContain('>mentalhealthgoals.co.uk</a>')
    expect(html).toContain('href="https://mentalhealthgoals.co.uk/privacy"')
  })

  it('keeps the message and inlines styles onto its bare tags', () => {
    expect(html).toContain('Dear Ada,')
    expect(html).toContain('<p style="margin:0 0 16px;">Dear Ada,</p>')
    expect(html).toContain('<a style="color:#15545B;" href="https://example.org">')
    expect(html).toContain('<table role="presentation"')
    expect(html).toMatch(/<td style="[^"]*font-weight:600;[^"]*">Full name<\/td>/)
    expect(html).toContain('Ada &amp; Co')
  })
})

describe('styleMessage', () => {
  it('leaves tags an editor styled themselves alone', () => {
    expect(styleMessage('<p class="lead">x</p><p>y</p>')).toBe(
      '<p class="lead">x</p><p style="margin:0 0 16px;">y</p>',
    )
  })
})

describe('emailText', () => {
  it('renders readable plain text with no markup, head or entities', () => {
    const text = emailText(
      brandedEmailHtml({ body, logoUrl: 'x', siteUrl: brand.siteUrl, programmeName: 'MHG' }),
    )
    expect(text).not.toMatch(/<|&amp;|&lt;/)
    expect(text).not.toContain('color-scheme')
    expect(text).toContain('Dear Ada,\n')
    expect(text).toContain('Full name Ada & Co')
    expect(text).toContain('MHG · mentalhealthgoals.co.uk · Privacy notice')
  })
})

describe('brandFormEmails', () => {
  const email = {
    to: 'a@example.org',
    from: 'noreply@example.org',
    replyTo: 'team@example.org',
    subject: 'Hello',
    html: body,
  }

  it('frames every email, adds a text part, and changes nothing else', () => {
    const [out] = brandFormEmails([email], brand)
    expect(out).toMatchObject({
      to: email.to,
      from: email.from,
      replyTo: email.replyTo,
      subject: 'Hello',
    })
    expect(out.html).toContain(`${EMAIL_ASSET_ORIGIN}/brand/rings/lockup-email.png`)
    expect(out.html).toContain('Dear Ada,')
    expect((out as { text?: string }).text).toContain('Dear Ada,')
  })
})

describe('beforeEmail', () => {
  const email = { to: 'a', from: 'b', replyTo: 'b', subject: 's', html: '<p>Hi</p>' }
  const req = (findGlobal: (args: { slug: string }) => Promise<unknown>) =>
    ({ payload: { findGlobal, logger: { warn: vi.fn() } } }) as never

  it('uses the lockup the site is set to and the programme name from the CMS', async () => {
    const globals: Record<string, unknown> = {
      brand: { logoVariant: 'sunInCol' },
      programmeDetails: { name: 'Mental Health Goals Programme' },
    }
    const r = req(async ({ slug }) => globals[slug])
    const [out] = await beforeEmail([email], { req: r } as never)
    expect(out.html).toContain('/brand/sunInCol/lockup-email.png')
    expect(out.html).toContain('alt="Mental Health Goals Programme"')
  })

  it('sends the message unframed rather than not at all when the frame fails', async () => {
    const r = req(async () => {
      throw new Error('database away')
    })
    const out = await beforeEmail([email], { req: r } as never)
    expect(out).toEqual([email])
    expect(
      (r as { payload: { logger: { warn: ReturnType<typeof vi.fn> } } }).payload.logger.warn,
    ).toHaveBeenCalled()
  })
})
