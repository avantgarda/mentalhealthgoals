import { describe, expect, it, vi } from 'vitest'

import type { Form } from '@/payload-types'
import { brandedEmailHtml, emailText, styleMessage } from '@/utilities/emailTemplate'
import {
  EMAIL_ASSET_ORIGIN,
  addresses,
  beforeEmail,
  brandFormEmails,
  submissionTable,
} from '@/utilities/formEmails'

/** The Forum form, as the CMS defines it. */
const forumFields: Form['fields'] = [
  { blockType: 'text', name: 'full-name', label: 'Full name', required: true },
  { blockType: 'email', name: 'email', label: 'Email', required: true },
  {
    blockType: 'select',
    name: 'attendance',
    label: 'Will you be attending?',
    required: true,
    options: [
      { label: 'I would like to attend on 8 October 2026', value: 'attending' },
      {
        label: 'I cannot make this one, but I am interested in future Forum meetings',
        value: 'future',
      },
    ],
  },
  {
    blockType: 'textarea',
    name: 'requirements',
    label: 'Access or dietary requirements (optional)',
  },
  {
    blockType: 'checkbox',
    name: 'consent',
    label: 'The Alliance Management Team may contact me about the Forum.',
    required: true,
  },
  {
    blockType: 'message',
    message: {
      root: { type: 'root', children: [], direction: null, format: '', indent: 0, version: 1 },
    },
  },
]

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

describe('submissionTable', () => {
  const entries = [
    { field: 'full-name', value: 'Ada <Lovelace>' },
    { field: 'email', value: 'ada@example.org' },
    { field: 'attendance', value: 'future' },
    { field: 'requirements', value: 'Step-free access\nNo nuts' },
    { field: 'consent', value: 'false' },
    { field: 'legacy', value: 'kept' },
    { field: 'formSubmissionID', value: '7' },
  ]
  const table = submissionTable(forumFields, entries, {
    id: 7,
    url: 'https://example.org/admin/collections/form-submissions/7',
  })
  const rows = [...table.matchAll(/<tr><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/g)].map((m) => [
    m[1],
    m[2],
  ])

  it('labels every row with the form’s own words, in the form’s order', () => {
    expect(rows.map(([label]) => label)).toEqual([
      'Full name',
      'Email',
      'Will you be attending?',
      'Access or dietary requirements (optional)',
      'The Alliance Management Team may contact me about the Forum.',
      'Legacy',
      'Submission',
    ])
  })

  it('shows the option a person chose, Yes or No for a box, and keeps line breaks', () => {
    expect(rows[2][1]).toBe('I cannot make this one, but I am interested in future Forum meetings')
    expect(rows[3][1]).toBe('Step-free access<br>No nuts')
    expect(rows[4][1]).toBe('No')
    expect(submissionTable(forumFields, [{ field: 'consent', value: 'true' }])).toContain(
      '<td>Yes</td>',
    )
  })

  it('escapes what people typed, and says when a field was left empty', () => {
    expect(rows[0][1]).toBe('Ada &lt;Lovelace&gt;')
    expect(submissionTable(forumFields, [])).toContain('<td>Full name</td><td>Not given</td>')
  })

  it('links the record in the CMS instead of listing a bare id', () => {
    expect(rows[6][1]).toBe(
      '<a href="https://example.org/admin/collections/form-submissions/7">#7</a>',
    )
    expect(table).not.toContain('formSubmissionID')
  })

  it('falls back to the stored value when an option no longer exists', () => {
    expect(submissionTable(forumFields, [{ field: 'attendance', value: 'gone' }])).toContain(
      '<td>gone</td>',
    )
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
    // …and says so on the message, for the recipient override to read.
    expect(toPerson.headers).toEqual({ 'X-MHG-Audience': 'person' })
    expect(toTeam.headers).toEqual({ 'X-MHG-Audience': 'team' })
  })

  it('treats every email as the team’s when no address was submitted', () => {
    const [out] = brandFormEmails([person], brand)
    expect(out.html).toContain(TEAM_NOTICE)
  })

  it('puts the labelled table where the plugin’s was, without reading it as a pattern', () => {
    const table = '<table><tr><td>Full name</td><td>$&amp; $1 Ada</td></tr></table>'
    const [out] = brandFormEmails([person], brand, [], table)
    expect(out.html).toContain('$&amp; $1 Ada')
    expect(out.html).not.toContain('Ada &amp; Co')
  })
})

describe('beforeEmail', () => {
  const person = { to: 'a@example.org', from: 'b', replyTo: 'b', subject: 's', html: '<p>Hi</p>' }
  const team = { ...person, to: 'team@example.org' }
  const req = (
    findGlobal: (args: { slug: string }) => Promise<unknown>,
    findByID: (args: { collection: string; id: unknown }) => Promise<unknown> = async () => ({
      fields: forumFields,
    }),
  ) => ({ payload: { findGlobal, findByID, logger: { warn: vi.fn() } } }) as never
  const data = {
    form: 26,
    submissionData: [
      { field: 'full-name', value: 'A' },
      { field: 'email', value: 'a@example.org' },
      { field: 'attendance', value: 'future' },
      { field: 'consent', value: 'true' },
    ],
  }
  const withTable = {
    ...team,
    html: '<p>New:</p><table><tr><td>consent</td><td>true</td></tr></table>',
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

  it('rebuilds the plugin’s table from the form it was submitted to, with a link to the record', async () => {
    const r = req(async () => ({}))
    const [out] = await beforeEmail([withTable], { req: r, data, doc: { id: 9 } } as never)
    expect(out.html).toContain('The Alliance Management Team may contact me about the Forum.')
    // The frame has styled the cell by now.
    expect(out.html).toMatch(/<td[^>]*>Yes<\/td>/)
    expect(out.html).toContain(
      'I cannot make this one, but I am interested in future Forum meetings',
    )
    expect(out.html).toMatch(/href="[^"]*\/admin\/collections\/form-submissions\/9"/)
    expect(out.html).not.toContain('<td>consent</td>')
  })

  it('keeps the plugin’s table, framed, when the form cannot be read', async () => {
    const r = req(
      async () => ({}),
      async () => {
        throw new Error('gone')
      },
    )
    const [out] = await beforeEmail([withTable], { req: r, data } as never)
    expect(out.html).toContain('<td style="')
    expect(out.html).toContain('consent</td>')
    expect(out.html).toContain(TEAM_NOTICE)
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
