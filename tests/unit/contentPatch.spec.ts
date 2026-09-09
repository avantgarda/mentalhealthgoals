import { describe, expect, it } from 'vitest'

import {
  assessChange,
  isUnpublishedDraft,
  matchValues,
  validatePlan,
  type ContentChange,
} from '../../scripts/lib/content-patch-core'

/**
 * The content patch tool writes to a deployed CMS, so its guard rails are the
 * only thing standing between a reviewed plan and someone's unrelated edit.
 * These cover the matching rules; the driver itself is exercised by hand
 * against a preview.
 */
const change: ContentChange = {
  collection: 'workstreams',
  match: { field: 'slug', value: 'example' },
  before: {
    title: 'Original',
    resources: [{ id: 'existing', label: 'Site', url: 'https://example.org' }],
  },
  after: {
    title: 'Revised',
    resources: [{ id: 'existing', label: 'Site', url: 'https://example.org' }],
  },
}

describe('assessChange', () => {
  it('matches content independently of environment-specific record IDs', () => {
    expect(assessChange({ id: 900, ...change.before }, change)).toBe('ready')
  })

  it('does not apply the change twice on a repeated run', () => {
    expect(assessChange({ id: 900, ...change.after }, change)).toBe('already applied')
  })

  it('refuses intervening edits, including edits inside nested arrays', () => {
    expect(() => assessChange({ ...change.before, title: 'Editor revision' }, change)).toThrow(
      /baseline/,
    )
    expect(() => assessChange({ ...change.before, resources: [] }, change)).toThrow(/baseline/)
  })

  it('accepts only the expected revised content when reversing', () => {
    const reverse = { ...change, before: change.after, after: change.before }
    expect(assessChange(change.after, reverse)).toBe('ready')
    expect(assessChange(change.before, reverse)).toBe('already applied')
    expect(() => assessChange({ ...change.after, title: 'Later work' }, reverse)).toThrow(
      /baseline/,
    )
  })

  it('accepts generated IDs only on explicitly new rows, including reversal', () => {
    const next: ContentChange = {
      ...change,
      generatedIds: ['new-row'],
      after: {
        ...change.after,
        resources: [
          ...(change.after.resources as object[]),
          { id: 'new-row', label: 'New', url: 'https://example.org/new' },
        ],
      },
    }
    const saved = structuredClone(next.after)
    const rows = saved.resources as { id: string; label: string }[]
    rows[1].id = 'server-generated'
    expect(assessChange(saved, next)).toBe('already applied')
    expect(assessChange(saved, { ...next, before: next.after, after: next.before })).toBe('ready')
    rows[1].label = 'Unexpected edit'
    expect(() => assessChange(saved, next)).toThrow(/baseline/)
    rows[1].label = 'New'
    rows[0].id = 'changed-existing-id'
    expect(() => assessChange(saved, next)).toThrow(/baseline/)
  })
})

describe('validatePlan', () => {
  const plan = { version: 1, name: 'Example', changes: [change] }

  it('allows only reviewed content fields and one entry per target', () => {
    expect(validatePlan(plan)).toBe(plan)
    expect(() => validatePlan({ ...plan, changes: [change, change] })).toThrow(/Duplicate/)
    expect(() =>
      validatePlan({
        ...plan,
        changes: [{ ...change, before: { hero: 'a' }, after: { hero: 'b' } }],
      }),
    ).toThrow(/field/)
    expect(() => validatePlan({ ...plan, changes: [{ ...change, collection: 'users' }] })).toThrow(
      /Invalid/,
    )
    expect(() => validatePlan({ ...plan, changes: [{ ...change, before: {} }] })).toThrow(/field/)
  })

  it('rejects generated ID exemptions for existing or missing rows', () => {
    for (const generatedIds of [['existing'], ['missing']]) {
      expect(() =>
        validatePlan({
          version: 1,
          name: 'Invalid exemptions',
          changes: [{ ...change, generatedIds }],
        }),
      ).toThrow(/new rows/)
    }
  })

  it('keeps a page URL out of reach while allowing a workstream to be renamed', () => {
    const renamed = {
      ...change,
      before: { ...change.before, slug: 'example' },
      after: { ...change.after, slug: 'renamed' },
    }
    expect(validatePlan({ ...plan, changes: [renamed] })).toBeTruthy()
    expect(() =>
      validatePlan({
        ...plan,
        changes: [
          {
            collection: 'pages',
            match: { field: 'slug', value: 'about' },
            before: { slug: 'about' },
            after: { slug: 'about-us' },
          },
        ],
      }),
    ).toThrow(/field/)
  })

  it('lets a post body be corrected but not its title or URL', () => {
    const post = (fields: Record<string, unknown>) => ({
      ...plan,
      changes: [
        {
          collection: 'posts',
          match: { field: 'slug', value: 'some-news' },
          before: fields,
          after: fields,
        },
      ],
    })
    expect(validatePlan(post({ content: { root: {} } }))).toBeTruthy()
    expect(() => validatePlan(post({ title: 'Renamed' }))).toThrow(/field/)
    expect(() => validatePlan(post({ slug: 'moved' }))).toThrow(/field/)
    expect(() => validatePlan(post({ populatedAuthors: [] }))).toThrow(/field/)
  })

  it('requires the match value to be the baseline slug, and the new one to be usable', () => {
    expect(() =>
      validatePlan({
        ...plan,
        changes: [
          {
            ...change,
            match: { field: 'slug', value: 'renamed' },
            before: { ...change.before, slug: 'example' },
            after: { ...change.after, slug: 'renamed' },
          },
        ],
      }),
    ).toThrow(/baseline slug/)
    expect(() =>
      validatePlan({
        ...plan,
        changes: [
          {
            ...change,
            before: { ...change.before, slug: 'example' },
            after: { ...change.after, slug: '' },
          },
        ],
      }),
    ).toThrow(/non-empty/)
  })

  it('catches a collision between one record’s new name and another’s current one', () => {
    expect(() =>
      validatePlan({
        version: 1,
        name: 'Colliding rename',
        changes: [
          {
            ...change,
            before: { ...change.before, slug: 'example' },
            after: { ...change.after, slug: 'second' },
          },
          { ...change, match: { field: 'slug', value: 'second' } },
        ],
      }),
    ).toThrow(/Duplicate/)
  })
})

describe('isUnpublishedDraft', () => {
  it('stops on an unpublished draft, whatever the collection is called', () => {
    // Pages and Posts both keep drafts; the check must not name either of them.
    expect(isUnpublishedDraft({ _status: 'draft' })).toBe(true)
    expect(isUnpublishedDraft({ _status: 'published' })).toBe(false)
  })

  it('passes a collection that keeps no drafts at all', () => {
    // Workstreams and People have no versions config, so no _status is returned.
    expect(isUnpublishedDraft({ title: 'Data Observatory' })).toBe(false)
    expect(isUnpublishedDraft({ _status: undefined })).toBe(false)
  })
})

describe('matchValues', () => {
  it('looks under one name when the plan leaves the slug alone', () => {
    expect(matchValues(change)).toEqual(['example'])
  })

  it('looks under both names when the plan rewrites the slug', () => {
    const renamed = {
      ...change,
      before: { ...change.before, slug: 'example' },
      after: { ...change.after, slug: 'renamed' },
    }
    expect(matchValues(renamed)).toEqual(['example', 'renamed'])
    // Reversal swaps the pair, and has to find the record under either name.
    expect(matchValues({ ...renamed, before: renamed.after, after: renamed.before })).toEqual([
      'example',
      'renamed',
    ])
  })

  it('finds a renamed record before and after the change is applied', () => {
    const renamed = {
      ...change,
      before: { ...change.before, slug: 'example' },
      after: { ...change.after, slug: 'renamed' },
    }
    expect(assessChange({ id: 900, ...renamed.before }, renamed)).toBe('ready')
    expect(assessChange({ id: 900, ...renamed.after }, renamed)).toBe('already applied')
  })
})
