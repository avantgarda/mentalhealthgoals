import { describe, expect, it, vi } from 'vitest'

import { brandedEmailHtml, emailText, styleMessage } from '@/utilities/emailTemplate'
import { EMAIL_ASSET_ORIGIN, addresses, beforeEmail, brandFormEmails } from '@/utilities/formEmails'

/**
 * The frame around form emails. What matters: the lockup and links are right,
 * the editor's message survives intact, the plugin's bare markup gets the
 * inline styles email clients need, the person and the team each get the
 * footer meant for them, and nothing here can stop an email.
 */
const body =
  '<div><p>Dear Ada,</p><p>Thank you for <a href="https://example.org">writing</a>.</p>' +
  '<table><tr><td>Full name</td><td>Ada &amp; Co</td></tr></table></div>'

const brand = {
  logoVariant: 'rings',
  programmeName: 'Mental Health Goals <Programme>',
  siteUrl: 'https://mentalhealthgoals.co.uk/',
}

const PERSON_NOTICE = 'You are receiving this email because you submitted a form on our website.'
const TEAM_NOTICE = 'Sent automatically by the website’s forms to the programme team.'

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

  it('explains to the person why they got it, and to the team what it is', () => {
    expect(html).toContain(PERSON_NOTICE)
    const team = brandedEmailHtml({
      body,
      logoUrl: 'x',
      siteUrl: brand.siteUrl,
      programmeName: 'MHG',
      audience: 'team',
    })
    expect(team).toContain(TEAM_NOTICE)
    expect(team).not.toContain(PERSON_NOTICE)
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

describe('addresses', () => {
  it('reads bare addresses out of any To header shape', () => {
    expect(addresses('Ada <Ada@Example.org>, team@example.org')).toEqual([
      'ada@example.org',
      'team@example.org',
    ])
    expect(addresses('ada@example.org')).toEqual(['ada@example.org'])
  })
})

describe('brandFormEmails', () => {
  const person = {
    to: 'ada@example.org',
    from: 'noreply@example.org',
    replyTo: 'team@example.org',
    subject: 'Hello',
    html: body,
  }
  const team = {
    ...person,
    to: 'team@example.org',
    replyTo: 'ada@example.org',
    subject: 'New enquiry',
  }

  it('frames every email, adds a text part, and changes nothing else', () => {
    const [out] = brandFormEmails([person], brand, ['ada@example.org'])
    expect(out).toMatchObject({
      to: person.to,
      from: person.from,
      replyTo: person.replyTo,
      subject: 'Hello',
    })
    expect(out.html).toContain(`${EMAIL_ASSET_ORIGIN}/brand/rings/lockup-email.png`)
    expect(out.html).toContain('Dear Ada,')
    expect((out as { text?: string }).text).toContain('Dear Ada,')
  })

  it('tells the person’s copy from the team’s by who typed the address in', () => {
    const [toPerson, toTeam] = brandFormEmails([person, team], brand, ['Ada@Example.org'])
    expect(toPerson.html).toContain(PERSON_NOTICE)
    expect(toTeam.html).toContain(TEAM_NOTICE)
  })

  it('treats every email as the team’s when no address was submitted', () => {
    const [out] = brandFormEmails([person], brand)
    expect(out.html).toContain(TEAM_NOTICE)
  })
})

describe('beforeEmail', () => {
  const person = { to: 'a@example.org', from: 'b', replyTo: 'b', subject: 's', html: '<p>Hi</p>' }
  const team = { ...person, to: 'team@example.org' }
  const req = (findGlobal: (args: { slug: string }) => Promise<unknown>) =>
    ({ payload: { findGlobal, logger: { warn: vi.fn() } } }) as never
  const data = {
    submissionData: [
      { field: 'full-name', value: 'A' },
      { field: 'email', value: 'a@example.org' },
    ],
  }

  it('uses the lockup the site is set to, the programme name, and the submitted address', async () => {
    const globals: Record<string, unknown> = {
      brand: { logoVariant: 'sunInCol' },
      programmeDetails: { name: 'Mental Health Goals Programme' },
    }
    const r = req(async ({ slug }) => globals[slug])
    const [toPerson, toTeam] = await beforeEmail([person, team], { req: r, data } as never)
    expect(toPerson.html).toContain('/brand/sunInCol/lockup-email.png')
    expect(toPerson.html).toContain('alt="Mental Health Goals Programme"')
    expect(toPerson.html).toContain(PERSON_NOTICE)
    expect(toTeam.html).toContain(TEAM_NOTICE)
  })

  it('sends the message unframed rather than not at all when the frame fails', async () => {
    const r = req(async () => {
      throw new Error('database away')
    })
    const out = await beforeEmail([person], { req: r, data } as never)
    expect(out).toEqual([person])
    expect(
      (r as { payload: { logger: { warn: ReturnType<typeof vi.fn> } } }).payload.logger.warn,
    ).toHaveBeenCalled()
  })
})
