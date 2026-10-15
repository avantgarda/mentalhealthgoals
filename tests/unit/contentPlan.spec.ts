import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

import {
  Minter,
  change,
  deriveExpectations,
  diff,
  fieldSegments,
  headText,
  inline,
  linkTarget,
  linkedMediaIds,
  links,
  paragraph,
  readerText,
  recordPaths,
  relink,
  relinkToMedia,
  render,
  renderReview,
  renderChecklist,
  segments,
  text,
  visibleText,
  writePlan,
} from '../../scripts/lib/content-plan'

/**
 * The plan library is what a private plan script leans on, and what turns a
 * plan into the checks that prove it landed. Fixtures are invented; nothing
 * here asserts on the programme's real copy.
 */
const link = (label: string, url: string) => ({
  type: 'link',
  fields: { url, linkType: 'custom' },
  children: [{ type: 'text', text: label }],
})
const rich = (...children: unknown[]) => ({ root: { type: 'root', children } })
const internal = (label: string, relationTo: string, value: number) => ({
  type: 'link',
  fields: { linkType: 'internal', newTab: false, doc: { relationTo, value } },
  children: [{ type: 'text', text: label }],
})
/** What the snapshot's `sources/` hold for the pages and files links pick. */
const sources = {
  pages: [
    { id: 1, slug: 'home' },
    { id: 2, slug: 'about' },
  ],
  posts: [{ id: 3, slug: 'launch' }],
  media: [
    {
      id: 41,
      filename: 'test-slides.pdf',
      mimeType: 'application/pdf',
      filesize: 2_300_000,
      url: '/api/media/file/test-slides.pdf',
    },
    {
      id: 42,
      filename: 'test slides v2.pdf',
      mimeType: 'application/pdf',
      filesize: 516_000,
      url: '/api/media/file/test%20slides%20v2.pdf',
    },
    {
      id: 43,
      filename: 'test-photo.png',
      mimeType: 'image/png',
      filesize: 80_000,
      url: '/api/media/file/test-photo.png',
    },
  ],
}

describe('Lexical helpers', () => {
  it('reads text, and shows links inline with their target', () => {
    const p = {
      type: 'paragraph',
      children: [{ type: 'text', text: 'See ' }, link('the hub', '/hub')],
    }
    expect(text(p)).toBe('See the hub')
    expect(inline(p)).toBe('See [the hub](/hub)')
  })

  it('counts list items as separate segments', () => {
    const list = {
      type: 'list',
      children: [
        { type: 'listitem', children: [{ type: 'text', text: 'One' }] },
        { type: 'listitem', children: [{ type: 'text', text: 'Two' }] },
      ],
    }
    expect(segments(list)).toEqual(['• One', '• Two'])
    expect(segments(paragraph('Plain'))).toEqual(['Plain'])
  })

  it('re-points only links with exactly the old URL, and reports how many', () => {
    const doc = rich({
      type: 'paragraph',
      children: [link('a', '/old'), link('b', '/old-ish'), link('c', '/old')],
    })
    expect(relink(doc, '/old', '/new')).toBe(2)
    expect(links(doc)).toEqual(['/new', '/old-ish', '/new'])
  })

  it('segments the words in any field shape, and only the words', () => {
    expect(fieldSegments('A line', 'summary')).toEqual(['A line'])
    expect(fieldSegments('data-observatory', 'slug')).toEqual([])
    expect(fieldSegments([{ id: 'x', point: 'Bullet' }], 'primaryFocus')).toEqual(['Bullet'])
    expect(fieldSegments([{ id: 'x', label: 'Site', url: 'https://e.org' }], 'resources')).toEqual([
      'Site: https://e.org',
    ])
    expect(fieldSegments(rich(paragraph('Body')), 'content')).toEqual(['Body'])
    expect(fieldSegments({ richText: rich(paragraph('Hero')), type: 'lowImpact' }, 'hero')).toEqual(
      ['Hero'],
    )
    expect(
      fieldSegments(
        [{ blockType: 'content', columns: [{ richText: rich(paragraph('Col')) }] }],
        'layout',
      ),
    ).toEqual(['Col'])
  })
})

describe('internal links', () => {
  it('names what an internal link picks, from the snapshot', () => {
    expect(inline(internal('Slides', 'media', 41), sources)).toBe('[Slides](media:test-slides.pdf)')
    expect(inline(internal('About us', 'pages', 2), sources)).toBe('[About us](page:/about)')
    expect(inline(internal('Home', 'pages', 1), sources)).toBe('[Home](page:/)')
    expect(inline(internal('News', 'posts', 3), sources)).toBe('[News](post:/posts/launch)')
  })

  it('falls back to the ID, so a re-pointed link still differs', () => {
    expect(inline(internal('Slides', 'media', 41))).toBe('[Slides](media#41)')
    expect(inline(internal('Slides', 'media', 99), sources)).toBe('[Slides](media#99)')
    expect(linkTarget({ linkType: 'internal' })).toBe('internal:?')
    // A populated link (depth > 0) names the same document.
    const populated = { linkType: 'internal', doc: { relationTo: 'pages', value: { id: 2 } } }
    expect(linkTarget(populated, sources)).toBe('page:/about')
  })

  it('ignores a URL left behind on an internal link', () => {
    const stale = internal('Slides', 'media', 41)
    Object.assign(stale.fields, { url: '/old.pdf' })
    expect(inline(stale, sources)).toBe('[Slides](media:test-slides.pdf)')
    expect(links(rich(stale), sources)).toEqual(['/api/media/file/test-slides.pdf'])
    expect(relink(rich(stale), '/old.pdf', '/new.pdf')).toBe(0)
  })

  it('reads a file link as the site renders it: words, then type and size', () => {
    const p = {
      type: 'paragraph',
      children: [{ type: 'text', text: 'Download the ' }, internal('Slides', 'media', 41)],
    }
    expect(readerText(p, sources)).toBe('Download the Slides (PDF, 2.3 MB)')
    // A file that is not there renders as plain words, as the site does.
    expect(readerText(p)).toBe('Download the Slides')
    expect(readerText(internal('About us', 'pages', 2), sources)).toBe('About us')
  })

  it('lists linked files by ID, once each', () => {
    const doc = rich(
      { type: 'paragraph', children: [internal('a', 'media', 41), internal('b', 'pages', 2)] },
      { type: 'paragraph', children: [internal('c', 'media', 41), internal('d', 'media', 42)] },
    )
    expect(linkedMediaIds([doc, link('e', '/api/media/file/test-slides.pdf')])).toEqual([41, 42])
  })

  it('shows a re-pointed internal link in the review', () => {
    const plan = {
      version: 1 as const,
      name: 'Re-point',
      changes: [
        {
          collection: 'posts' as const,
          match: { field: 'slug' as const, value: 'launch' },
          before: {
            content: rich({ type: 'paragraph', children: [internal('Slides', 'media', 41)] }),
          },
          after: {
            content: rich({ type: 'paragraph', children: [internal('Slides', 'media', 42)] }),
          },
        },
      ],
    }
    expect(renderReview(plan, undefined, sources)).toContain(
      'Changed:\n\n> [Slides](media:test-slides.pdf)\n\nto:\n\n> [Slides](media:test slides v2.pdf)',
    )
    expect(renderReview(plan)).toContain('> [Slides](media#41)\n\nto:\n\n> [Slides](media#42)')
  })
})

describe('relinkToMedia', () => {
  const typed = (label: string, url: string, newTab = false) => ({
    type: 'link',
    fields: { url, linkType: 'custom', newTab },
    children: [{ type: 'text', text: label }],
  })
  const page = () =>
    rich(
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'Download the ' },
          typed('Launch slides (PDF, 2.3 MB)', '/api/media/file/test-slides.pdf', true),
          { type: 'text', text: '.' },
        ],
      },
      {
        type: 'list',
        children: [
          {
            type: 'listitem',
            children: [
              typed('Version two (PDF, 516 KB)', '/api/media/file/test%20slides%20v2.pdf'),
            ],
          },
          { type: 'listitem', children: [typed('Elsewhere', 'https://example.org/report.pdf')] },
        ],
      },
    )

  it('points typed file links at the file in Media, as the picker would', () => {
    const doc = page()
    expect(relinkToMedia(doc, sources)).toEqual(['test-slides.pdf', 'test slides v2.pdf'])
    const [, slides] = (doc.root.children[0] as { children: unknown[] }).children
    expect(slides).toEqual({
      type: 'link',
      fields: { linkType: 'internal', newTab: true, doc: { relationTo: 'media', value: 41 } },
      children: [{ type: 'text', text: 'Launch slides' }],
    })
    expect(segments(doc.root.children[0], sources)).toEqual([
      'Download the [Launch slides](media:test-slides.pdf).',
    ])
    expect(segments(doc.root.children[1], sources)).toEqual([
      '• [Version two](media:test slides v2.pdf)',
      '• [Elsewhere](https://example.org/report.pdf)',
    ])
  })

  it('leaves the words a reader sees unchanged when the typed size was right', () => {
    const before = page()
    const after = page()
    relinkToMedia(after, sources)
    for (const i of [0, 1])
      expect(readerText(after.root.children[i], sources)).toBe(
        readerText(before.root.children[i], sources),
      )
  })

  it('drops a size typed in a text node of its own, and the space before it', () => {
    const link = typed('Slides ', '/api/media/file/test-slides.pdf')
    link.children.push({ type: 'text', text: '(PDF, 2.3 MB)' })
    relinkToMedia(rich({ type: 'paragraph', children: [link] }), sources)
    expect(link.children).toEqual([{ type: 'text', text: 'Slides' }])
  })

  it('keeps words that only look like a size', () => {
    const link = typed('Annual report (2025)', '/api/media/file/test-slides.pdf')
    relinkToMedia(rich({ type: 'paragraph', children: [link] }), sources)
    expect(text(link)).toBe('Annual report (2025)')
  })

  it.each([
    ['/api/media/file/missing.pdf', /No file named "missing.pdf" in Media/],
    ['/api/media/file/test-photo.png', /"test-photo.png" in Media is image\/png, not a PDF/],
  ])('refuses %s', (url, message) => {
    expect(() => relinkToMedia(rich(typed('File', url)), sources)).toThrow(message)
  })

  it('refuses without a Media snapshot, a size outside the link, or a link of size alone', () => {
    const file = '/api/media/file/test-slides.pdf'
    expect(() => relinkToMedia(rich(typed('File', file)), { pages: [] })).toThrow(/media\.json/)
    const outside = {
      type: 'paragraph',
      children: [typed('Slides', file), { type: 'text', text: ' (PDF, 2.3 MB).' }],
    }
    expect(() => relinkToMedia(rich(outside), sources)).toThrow(/size follows the link/)
    expect(() => relinkToMedia(rich(typed('(PDF, 2.3 MB)', file)), sources)).toThrow(
      /no words besides its size/,
    )
  })

  it('leaves other links, and links already picked, alone', () => {
    const doc = rich({
      type: 'paragraph',
      children: [
        typed('Elsewhere', '/api/media/file-list'),
        typed('Absolute', 'https://example.org/api/media/file/test-slides.pdf'),
        internal('Picked', 'media', 41),
      ],
    })
    const copy = structuredClone(doc)
    expect(relinkToMedia(doc, sources)).toEqual([])
    expect(doc).toEqual(copy)
  })
})

describe('diff and review', () => {
  it('reads an insertion as one addition, not a cascade of replacements', () => {
    expect(diff(['a', 'b', 'c'], ['a', 'new', 'b', 'c'])).toEqual([['+', 'new']])
    expect(render(diff(['a', 'b'], ['a', 'x']))).toContain('Changed:\n\n> b\n\nto:\n\n> x')
    expect(render([])).toBe('No change.')
  })

  it('shows partner creation and relationship changes even when copy stays the same', () => {
    const reference = '__PARTNER_EXAMPLE__'
    const plan = {
      version: 1 as const,
      name: 'Partner update',
      createPartners: [
        {
          reference,
          data: {
            name: 'Example',
            url: 'https://example.org/',
            role: 'partner' as const,
            showInFooter: false as const,
            usageNote: 'Text only.',
          },
        },
      ],
      changes: [
        {
          collection: 'pages' as const,
          match: { field: 'slug' as const, value: 'about' },
          before: {
            layout: [{ blockType: 'partnerLogos', heading: 'Working with', partners: [4] }],
          },
          after: {
            layout: [
              { blockType: 'partnerLogos', heading: 'Working with', partners: [4, reference] },
            ],
          },
        },
      ],
    }
    const review = renderReview(plan)
    expect(review).toContain('New programme partner: Example')
    expect(review).toContain('layout.0.partners')
    expect(review).toContain('[4,"__PARTNER_EXAMPLE__"]')
    expect(review).not.toContain('nothing is created')
    expect(renderChecklist(plan)).toContain('Live `/about` reviewed on desktop and mobile')
    expect(renderChecklist(plan)).toContain('full biographies and image alt text')
  })

  it('writes a review that names a URL change and shows only what moved', () => {
    const plan = {
      version: 1 as const,
      name: 'Example',
      changes: [
        {
          collection: 'workstreams' as const,
          match: { field: 'slug' as const, value: 'old' },
          before: { slug: 'old', title: 'Old title', summary: 'Same' },
          after: { slug: 'new', title: 'New title', summary: 'Same' },
        },
      ],
    }
    const md = renderReview(plan, 'applied to preview')
    expect(md).toContain('**Status: applied to preview**')
    expect(md).toContain('`/workstreams/old` becomes `/workstreams/new`')
    expect(md).toContain('### title')
    expect(md).not.toContain('### summary')
    expect(md).not.toContain('### slug')
  })
})

describe('building a change', () => {
  it('derives before from the snapshot for exactly the fields being rewritten', () => {
    const doc = { id: 7, slug: 'ws', title: 'T', summary: 'S', untouched: 'U' }
    expect(change('workstreams', doc, { title: 'T2' })).toEqual({
      collection: 'workstreams',
      match: { field: 'slug', value: 'ws' },
      before: { title: 'T' },
      after: { title: 'T2' },
    })
  })

  it('declares minted row IDs so Payload’s replacements are tolerated', () => {
    const m = new Minter()
    const row = { id: m.mint(), point: 'New bullet' }
    const doc = { id: 7, slug: 'ws', primaryFocus: [] as unknown[] }
    expect(change('workstreams', doc, { primaryFocus: [row] }, m).generatedIds).toEqual([row.id])
    expect(change('workstreams', doc, { title: 'x' }, new Minter()).generatedIds).toBeUndefined()
  })

  it('matches people by name', () => {
    const c = change('people', { id: 1, name: 'A. Person', role: 'Lead' }, { role: 'Co-lead' })
    expect(c.match).toEqual({ field: 'name', value: 'A. Person' })
  })
})

describe('writePlan', () => {
  const dir = mkdtempSync(join(tmpdir(), 'plan-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('validates before writing, and writes both artefacts', () => {
    const doc = { id: 1, slug: 'about', layout: [] as unknown[] }
    expect(() => writePlan(dir, 'Bad', [change('pages', doc, { title: 'x' })])).toThrow(/field/)
    writePlan(dir, 'Good', [
      change('pages', doc, { layout: [{ blockType: 'content', columns: [] }] }),
    ])
    expect(JSON.parse(readFileSync(join(dir, 'plan.json'), 'utf8')).name).toBe('Good')
    expect(readFileSync(join(dir, 'review.md'), 'utf8')).toContain('# Good')
  })

  it('names linked files in the review from the snapshot beside the plan', () => {
    const withSources = mkdtempSync(join(tmpdir(), 'plan-'))
    try {
      mkdirSync(join(withSources, 'sources'))
      writeFileSync(join(withSources, 'sources/media.json'), JSON.stringify(sources.media))
      const before = rich({
        type: 'paragraph',
        children: [link('Slides (PDF, 2.3 MB)', '/api/media/file/test-slides.pdf')],
      })
      const after = structuredClone(before)
      relinkToMedia(after, sources)
      writePlan(withSources, 'Files', [
        change('posts', { id: 3, slug: 'launch', content: before }, { content: after }),
      ])
      const review = readFileSync(join(withSources, 'review.md'), 'utf8')
      expect(review).toContain('> [Slides (PDF, 2.3 MB)](/api/media/file/test-slides.pdf)')
      expect(review).toContain('> [Slides](media:test-slides.pdf)')
      expect(readFileSync(join(withSources, 'qa.md'), 'utf8')).toContain(
        'Every file link opens the right PDF',
      )
    } finally {
      rmSync(withSources, { recursive: true, force: true })
    }
  })
})

describe('expectations derived from a plan', () => {
  const post = (url: string) =>
    rich({ type: 'paragraph', children: [{ type: 'text', text: 'Read ' }, link('more', url)] })
  const plan = {
    version: 1 as const,
    name: 'Derive',
    changes: [
      {
        collection: 'workstreams' as const,
        match: { field: 'slug' as const, value: 'old-slug' },
        before: {
          slug: 'old-slug',
          title: 'Old',
          summary: 'A sentence that is certainly longer than forty characters.',
          resources: [] as unknown[],
        },
        after: {
          slug: 'new-slug',
          title: 'New',
          summary: 'Different wording, also comfortably past forty characters.',
          resources: [{ id: 'r1', label: 'Site', url: 'https://e.org' }],
        },
      },
      {
        collection: 'posts' as const,
        match: { field: 'slug' as const, value: 'news' },
        before: { content: post('/workstreams/old-slug') },
        after: { content: post('/workstreams/new-slug') },
      },
    ],
  }
  const out = deriveExpectations(plan)

  it('expects the old URL to 404 and the new one, or its index, to carry the words', () => {
    expect(out[0]).toMatchObject({ paths: ['/workstreams/old-slug'], expectStatus: 404 })
    expect(out[1]).toMatchObject({
      paths: ['/workstreams/new-slug', '/workstreams'],
      expectStatus: 200,
    })
    expect(out[1].expectText).toEqual([
      'New',
      'Different wording, also comfortably past forty characters.',
      'Site',
    ])
    expect(out[1].rejectText).toEqual([
      'A sentence that is certainly longer than forty characters.',
    ])
    expect(out[1].expectHref).toEqual(['https://e.org'])
  })

  it('never mistakes a slug or a link URL for a passage a reader sees', () => {
    expect(out[1].expectText).not.toContain('new-slug')
    expect(out[1].expectText).not.toContain('https://e.org')
  })

  it('turns a moved link into href expectations and nothing else', () => {
    expect(out[2]).toMatchObject({
      paths: ['/posts/news'],
      expectHref: ['/workstreams/new-slug'],
      rejectHref: ['/workstreams/old-slug'],
      expectText: [],
    })
  })

  it('allows retained wording inside an extended passage while still rejecting removed copy', () => {
    const retained = 'Closing reflections — Dr Example and colleagues'
    const revised = `${retained} (16:00–16:20).`
    const removed = 'The obsolete discussion slot with a speaker still to be confirmed.'
    const [expectation] = deriveExpectations({
      version: 1,
      name: 'Expanded timetable',
      changes: [
        {
          collection: 'pages',
          match: { field: 'slug', value: 'example-event' },
          before: {
            layout: [{ agenda: [{ item: retained }, { item: removed }] }],
          },
          after: {
            layout: [{ agenda: [{ item: revised }] }],
          },
        },
      ],
    })
    const live = visibleText(`<li>16:00 <span>${revised}</span></li>`)
    expect(expectation.expectText).toEqual([revised])
    expect(expectation.rejectText).toEqual([removed])
    expect(expectation.expectText.every((passage) => live.includes(passage))).toBe(true)
    expect(expectation.rejectText.some((passage) => live.includes(passage))).toBe(false)
    expect(expectation.rejectText.some((passage) => `${live} ${removed}`.includes(passage))).toBe(
      true,
    )
  })

  it('expects what the site shows after a file link: its type and size', () => {
    const paragraphWith = (label: string, node: unknown) =>
      rich({ type: 'paragraph', children: [{ type: 'text', text: label }, node] })
    const conversion = (typed: string) => ({
      version: 1 as const,
      name: 'Files',
      changes: [
        {
          collection: 'pages' as const,
          match: { field: 'slug' as const, value: 'forum' },
          before: {
            layout: [
              {
                columns: [
                  {
                    richText: paragraphWith(
                      'Presentations from the launch meeting are here: ',
                      link(`Slides (${typed})`, '/api/media/file/test-slides.pdf'),
                    ),
                  },
                ],
              },
            ],
          },
          after: {
            layout: [
              {
                columns: [
                  {
                    richText: paragraphWith(
                      'Presentations from the launch meeting are here: ',
                      internal('Slides', 'media', 41),
                    ),
                  },
                ],
              },
            ],
          },
        },
      ],
    })
    // The typed size was right: the page reads and links exactly as before.
    const [same] = deriveExpectations(conversion('PDF, 2.3 MB'), sources)
    expect(same).toMatchObject({ expectText: [], rejectText: [], expectHref: [], rejectHref: [] })
    // It was not: the corrected size must show, and the old one must be gone.
    const [corrected] = deriveExpectations(conversion('PDF, 2.2 MB'), sources)
    expect(corrected.expectText).toEqual([
      'Presentations from the launch meeting are here: Slides (PDF, 2.3 MB)',
    ])
    expect(corrected.rejectText).toEqual([
      'Presentations from the launch meeting are here: Slides (PDF, 2.2 MB)',
    ])
    expect(corrected.expectHref).toEqual([])
  })

  it('expects a picked file link’s label and href, and drops the old file’s', () => {
    const body = (...children: unknown[]) => ({
      content: rich(paragraph('Unchanged opening paragraph.'), { type: 'paragraph', children }),
    })
    const plan = (before: unknown[], after: unknown[]) => ({
      version: 1 as const,
      name: 'Picked files',
      changes: [
        {
          collection: 'posts' as const,
          match: { field: 'slug' as const, value: 'launch' },
          before: body(...before),
          after: body(...after),
        },
      ],
    })
    const words = { type: 'text', text: 'Download the ' }
    const [added] = deriveExpectations(plan([], [words, internal('Slides', 'media', 41)]), sources)
    expect(added.expectText).toEqual(['Download the Slides (PDF, 2.3 MB)'])
    expect(added.expectHref).toEqual(['/api/media/file/test-slides.pdf'])
    const [moved] = deriveExpectations(
      plan([words, internal('Slides', 'media', 41)], [words, internal('Slides', 'media', 42)]),
      sources,
    )
    expect(moved.expectText).toEqual(['Download the Slides (PDF, 516 KB)'])
    expect(moved.expectHref).toEqual(['/api/media/file/test%20slides%20v2.pdf'])
    expect(moved.rejectHref).toEqual(['/api/media/file/test-slides.pdf'])
  })

  it('knows where each collection renders', () => {
    expect(recordPaths('pages', 'home')).toEqual(['/'])
    expect(recordPaths('pages', 'about')).toEqual(['/about'])
    expect(recordPaths('people', 'Anyone')).toEqual(['/people'])
  })

  it('checks corrected names on /people without treating a name as a moved URL', () => {
    const out = deriveExpectations({
      version: 1,
      name: 'Name correction',
      changes: [
        {
          collection: 'people',
          match: { field: 'name', value: 'Dr Example' },
          before: { name: 'Dr Example' },
          after: { name: 'Prof. Example' },
        },
      ],
    })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      paths: ['/people'],
      expectStatus: 200,
      expectText: ['Prof. Example'],
    })
  })

  it('compares against what a reader sees, not the markup', () => {
    expect(visibleText('<p>Tom &amp; <a href="/x">Jerry</a>’s\n  day</p>')).toBe(
      'Tom & Jerry’s day',
    )
  })
})

describe('head metadata', () => {
  const meta = (title: string, description: string) => ({ title, description, image: 3 })
  const page = (before: ReturnType<typeof meta>, after: ReturnType<typeof meta>) => ({
    version: 1 as const,
    name: 'Meta',
    changes: [
      {
        collection: 'pages' as const,
        match: { field: 'slug' as const, value: 'industry' },
        before: { meta: before },
        after: { meta: after },
      },
    ],
  })

  it('checks a page’s SEO description against the head, never the body', () => {
    const [e] = deriveExpectations(
      page(
        meta('For industry', 'The old description, long enough to have counted as a passage.'),
        meta('For industry', 'The new description, which no reader ever sees in the body.'),
      ),
    )
    expect(e.expectText).toEqual([])
    expect(e.rejectText).toEqual([])
    expect(e.expectHead).toEqual([
      { head: 'description', text: 'The new description, which no reader ever sees in the body.' },
    ])
    expect(e.rejectHead).toEqual([
      {
        head: 'description',
        text: 'The old description, long enough to have counted as a passage.',
      },
    ])
  })

  it('expects a changed title in the head too, and nothing for an unchanged one', () => {
    const [same] = deriveExpectations(page(meta('T', 'D'), meta('T', 'D')))
    expect(same.expectHead).toEqual([])
    expect(same.rejectHead).toEqual([])
    const [renamed] = deriveExpectations(page(meta('Old title', 'D'), meta('New title', 'D')))
    expect(renamed.expectHead).toEqual([{ head: 'title', text: 'New title' }])
    expect(renamed.rejectHead).toEqual([{ head: 'title', text: 'Old title' }])
  })

  it('reads the title and description out of a document head, decoded', () => {
    const html =
      '<html><head><title>For industry | Site &amp; Co</title>' +
      '<meta content="Tom &amp; Jerry&#x27;s  day" name="description"/>' +
      '<meta property="og:description" content="Not this one"/></head>' +
      '<body><p>Body</p></body></html>'
    expect(headText(html)).toEqual({
      title: 'For industry | Site & Co',
      description: "Tom & Jerry's day",
    })
  })
})
