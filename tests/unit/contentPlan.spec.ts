import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

import {
  Minter,
  change,
  deriveExpectations,
  diff,
  fieldSegments,
  inline,
  links,
  paragraph,
  recordPaths,
  relink,
  render,
  renderReview,
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

describe('diff and review', () => {
  it('reads an insertion as one addition, not a cascade of replacements', () => {
    expect(diff(['a', 'b', 'c'], ['a', 'new', 'b', 'c'])).toEqual([['+', 'new']])
    expect(render(diff(['a', 'b'], ['a', 'x']))).toContain('Changed:\n\n> b\n\nto:\n\n> x')
    expect(render([])).toBe('No change.')
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

  it('knows where each collection renders', () => {
    expect(recordPaths('pages', 'home')).toEqual(['/'])
    expect(recordPaths('pages', 'about')).toEqual(['/about'])
    expect(recordPaths('people', 'Anyone')).toEqual(['/people'])
  })

  it('compares against what a reader sees, not the markup', () => {
    expect(visibleText('<p>Tom &amp; <a href="/x">Jerry</a>’s\n  day</p>')).toBe(
      'Tom & Jerry’s day',
    )
  })
})
