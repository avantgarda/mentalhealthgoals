import { describe, expect, it } from 'vitest'

import {
  assessChange,
  checkCanary,
  isCanaryAddress,
  isUnpublishedDraft,
  matchFieldFor,
  matchValues,
  MAX_UPLOAD_BYTES,
  resolveReferences,
  sameDocument,
  validatePlan,
  type ContentChange,
} from '../../scripts/lib/content-patch-core'

/**
 * The content patch tool writes to a deployed CMS, so its guard rails are the
 * only thing standing between a reviewed plan and someone's unrelated edit.
 * Matching rules here; contentRunner.spec.ts exercises the write sequence and
 * contentHandoff.spec.ts exercises the command-line handoff without a live CMS.
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

describe('assessChange on rich text', () => {
  // A block seeded without an id gets a fresh one from Payload on every read.
  const block = (id: string, text: string) => ({
    root: { children: [{ type: 'block', fields: { id, blockType: 'banner', text } }] },
  })
  const post: ContentChange = {
    collection: 'posts',
    match: { field: 'slug', value: 'news' },
    before: { content: block('read-1', 'Original') },
    after: { content: block('read-1', 'Revised') },
  }

  it('ignores a Lexical block’s regenerated fields.id and nothing else in the block', () => {
    expect(assessChange({ content: block('read-2', 'Original') }, post)).toBe('ready')
    expect(assessChange({ content: block('read-3', 'Revised') }, post)).toBe('already applied')
    expect(() => assessChange({ content: block('read-4', 'Edited') }, post)).toThrow(/baseline/)
  })

  it('treats two reads that differ only in a block’s minted id as the same document', () => {
    const doc = (id: string, title: string) => ({ id: 79, title, content: block(id, 'Body') })
    expect(sameDocument(doc('read-1', 'News'), doc('read-2', 'News'))).toBe(true)
    expect(sameDocument(doc('read-1', 'News'), doc('read-1', 'Edited'))).toBe(false)
    expect(sameDocument(doc('read-1', 'News'), { ...doc('read-1', 'News'), extra: 1 })).toBe(false)
  })

  it('still holds an ordinary node’s id to the baseline', () => {
    const para = (id: string) => ({ root: { children: [{ type: 'paragraph', id, text: 'x' }] } })
    const change: ContentChange = {
      ...post,
      before: { content: para('p1') },
      after: { content: para('p1') },
    }
    expect(() => assessChange({ content: para('p2') }, change)).toThrow(/baseline/)
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

  it('supports existing-person name corrections without opening Team creation', () => {
    const person = {
      collection: 'people',
      match: { field: 'name', value: 'Dr Example' },
      before: { name: 'Dr Example', role: 'Lead' },
      after: { name: 'Prof. Example', role: 'Co-lead' },
    }
    expect(validatePlan({ ...plan, changes: [person] })).toBeTruthy()
    expect(() => validatePlan({ ...plan, changes: [person], createPeople: [{}] })).toThrow(
      /Unsupported/,
    )
    expect(() =>
      validatePlan({ ...plan, changes: [{ ...person, after: { name: 'Prof. Example' } }] }),
    ).toThrow(/field/)
  })

  it('restricts new partner declarations and reference placement', () => {
    const reference = '__PARTNER_EXAMPLE__'
    const partner = {
      reference,
      data: {
        name: 'Example partner',
        url: 'https://example.org/',
        role: 'partner',
        showInFooter: false,
        usageNote: 'Text only.',
      },
    }
    const relationship = {
      ...change,
      before: { partners: [4] },
      after: { partners: [4, reference] },
    }
    const bundle = { ...plan, changes: [relationship], createPartners: [partner] }
    expect(validatePlan(bundle)).toBeTruthy()
    expect(() => validatePlan({ ...bundle, createPartners: [partner, partner] })).toThrow(
      /duplicate/,
    )
    expect(() =>
      validatePlan({
        ...bundle,
        createPartners: [{ ...partner, data: { ...partner.data, logo: 5 } }],
      }),
    ).toThrow(/creation/)
    expect(() =>
      validatePlan({
        ...bundle,
        createPartners: [{ ...partner, data: { ...partner.data, showInFooter: true } }],
      }),
    ).toThrow(/creation/)
    expect(() =>
      validatePlan({
        ...bundle,
        changes: [{ ...change, before: { title: 'Old' }, after: { title: reference } }],
      }),
    ).toThrow(/reference/)
    expect(() => validatePlan({ ...bundle, createPartners: [] })).toThrow(/reference/)
    expect(() => validatePlan({ ...bundle, changes: [change] })).toThrow(/referenced/)
    expect(() =>
      validatePlan({
        ...bundle,
        changes: [{ ...relationship, before: { partners: [reference] } }],
      }),
    ).toThrow(/reference/)
    expect(() =>
      validatePlan({ ...plan, changes: [{ ...relationship, after: { partners: [4, 4] } }] }),
    ).toThrow(/IDs/)
    const page = {
      collection: 'pages',
      match: { field: 'slug', value: 'about' },
      before: { layout: [{ blockType: 'partnerLogos', partners: [4] }] },
      after: { layout: [{ blockType: 'partnerLogos', partners: [4, reference] }] },
    }
    expect(validatePlan({ ...bundle, changes: [page] })).toBeTruthy()
    expect(() =>
      validatePlan({
        ...bundle,
        changes: [{ ...page, after: { layout: [{ blockType: 'people', people: [reference] }] } }],
      }),
    ).toThrow(/reference/)
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

describe('files a plan uploads', () => {
  const reference = '__MEDIA_EXAMPLE__'
  const upload = {
    reference,
    file: 'files/Example slides.pdf',
    filename: 'example-slides.pdf',
    alt: 'Example slides',
    mimeType: 'application/pdf',
    filesize: 1_500,
    sha256: 'a'.repeat(64),
  }
  const fileLink = (value: unknown, relationTo = 'media') => ({
    type: 'link',
    fields: { linkType: 'internal', newTab: false, doc: { relationTo, value } },
    children: [{ type: 'text', text: 'Example slides' }],
  })
  const rich = (...children: unknown[]) => ({ root: { type: 'root', children } })
  const page = (...children: unknown[]) => ({
    collection: 'pages',
    match: { field: 'slug', value: 'about' },
    before: { layout: [] },
    after: { layout: [{ blockType: 'content', columns: [{ richText: rich(...children) }] }] },
  })
  const bundle = (overrides: Record<string, unknown> = {}, ...children: unknown[]) => ({
    version: 1,
    name: 'Invented upload',
    changes: [page(...(children.length ? children : [fileLink(reference)]))],
    uploadMedia: [{ ...upload, ...overrides }],
  })

  it('accepts a declared PDF linked from after, and nothing looser', () => {
    expect(validatePlan(bundle())).toBeTruthy()
    for (const filename of ['Example-slides.pdf', 'example slides.pdf', 'example_slides.pdf'])
      expect(() => validatePlan(bundle({ filename }))).toThrow(/lowercase words/)
    expect(() => validatePlan(bundle({ filename: 'example-slides.docx' }))).toThrow(/\.pdf/)
    expect(() => validatePlan(bundle({ mimeType: 'image/png' }))).toThrow(/Only PDFs/)
    expect(() => validatePlan(bundle({ alt: ' ' }))).toThrow(/alt text/)
    expect(() => validatePlan(bundle({ filesize: MAX_UPLOAD_BYTES + 1 }))).toThrow(/larger/)
    expect(() => validatePlan(bundle({ sha256: undefined }))).toThrow(/SHA-256/)
    for (const file of ['../elsewhere.pdf', '/tmp/example.pdf', 'files//example.pdf'])
      expect(() => validatePlan(bundle({ file }))).toThrow(/inside the plan/)
    expect(() => validatePlan(bundle({ caption: 'Not allowed' }))).toThrow(/Invalid media upload/)
    expect(() => validatePlan(bundle({ reference: '__PARTNER_EXAMPLE__' }))).toThrow(
      /Invalid media upload/,
    )
    expect(() =>
      validatePlan({ ...bundle(), uploadMedia: [upload, { ...upload, reference: '__MEDIA_B__' }] }),
    ).toThrow(/Duplicate/)
  })

  it('places a reference only as the file an internal link picks, in after', () => {
    expect(() => validatePlan(bundle({}, fileLink(reference, 'pages')))).toThrow(/Media reference/)
    expect(() =>
      validatePlan(bundle({}, { type: 'upload', relationTo: 'media', value: reference })),
    ).toThrow(/Media reference/)
    expect(() =>
      validatePlan(bundle({}, { type: 'text', text: reference }, fileLink(reference))),
    ).toThrow(/Media reference/)
    expect(() => validatePlan(bundle({}, fileLink('__MEDIA_UNDECLARED__')))).toThrow(
      /Media reference/,
    )
    const [linking] = bundle().changes
    expect(() =>
      validatePlan({ ...bundle(), changes: [{ ...linking, before: linking.after }] }),
    ).toThrow(/Media reference/)
  })

  it('requires every upload to be linked, until a run resolves it', () => {
    expect(() => validatePlan(bundle({}, fileLink(5)))).toThrow(/must be linked/)
    expect(validatePlan(bundle({ id: 12 }, fileLink(12)))).toBeTruthy()
    expect(() => validatePlan(bundle({ id: 'twelve' }, fileLink(12)))).toThrow(/Media ID/)
  })

  it('resolves a reference in after to the Media ID, and records the ID', () => {
    const resolved = resolveReferences(validatePlan(bundle()), new Map([[reference, 12]]))
    expect(JSON.stringify(resolved.changes)).not.toContain(reference)
    expect(resolved.changes[0].after).toEqual(page(fileLink(12)).after)
    expect(resolved.uploadMedia).toEqual([{ ...upload, id: 12 }])
    expect(validatePlan(resolved)).toBeTruthy()
    const pending = resolveReferences(validatePlan(bundle()), new Map())
    expect(pending.uploadMedia?.[0].id).toBeUndefined()
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

describe('checkCanary', () => {
  it('recognises a reserved .invalid address and nothing else', () => {
    expect(isCanaryAddress('content-review-1a2b@mentalhealthgoals.invalid')).toBe(true)
    expect(isCanaryAddress('someone@mentalhealthgoals.co.uk')).toBe(false)
    expect(isCanaryAddress('invalid@example.com')).toBe(false)
  })

  it('accepts only the canary on preview, and never the canary on production', () => {
    expect(() => checkCanary('preview', 'editor@mentalhealthgoals.co.uk')).toThrow(
      /temporary editor/,
    )
    expect(() => checkCanary('preview', 'x@mentalhealthgoals.invalid')).not.toThrow()
    expect(() => checkCanary('production', 'x@mentalhealthgoals.invalid')).toThrow(/canary/)
    expect(() => checkCanary('production', 'editor@mentalhealthgoals.co.uk')).not.toThrow()
  })

  it('matches people by name and everything else by slug', () => {
    expect(matchFieldFor('people')).toBe('name')
    expect(matchFieldFor('pages')).toBe('slug')
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
