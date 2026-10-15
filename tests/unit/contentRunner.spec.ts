// @vitest-environment node
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CmsClient, Deployment } from '../../scripts/lib/cms-client'
import { validatePlan, type ContentPlan } from '../../scripts/lib/content-patch-core'
import { runContentPatch } from '../../scripts/lib/content-patch-runner'

type Doc = Record<string, unknown> & { id: number; updatedAt: string }
const deployment: Deployment = { hostname: 'example.vercel.app', environment: 'production' }
const reference = '__PARTNER_EXAMPLE__'
const partner = {
  reference,
  data: {
    name: 'Example partner',
    url: 'https://example.org/',
    role: 'partner' as const,
    showInFooter: false as const,
    usageNote: 'Text only.',
  },
}
const plan: ContentPlan = {
  version: 1,
  name: 'Invented CMS update',
  createPartners: [partner],
  changes: [
    {
      collection: 'workstreams',
      match: { field: 'slug', value: 'example' },
      before: { partners: [4], title: 'Old title' },
      after: { partners: [4, reference], title: 'New title' },
    },
    {
      collection: 'people',
      match: { field: 'name', value: 'Dr Example' },
      before: { name: 'Dr Example', role: 'Lead' },
      after: { name: 'Prof. Example', role: 'Co-lead' },
    },
    {
      collection: 'pages',
      match: { field: 'slug', value: 'about' },
      before: { layout: [] },
      after: { layout: [{ blockType: 'partnerLogos', partners: [4, reference] }] },
    },
  ],
}

function fixture() {
  const state: Record<string, Doc[]> = {
    partners: [],
    workstreams: [
      {
        id: 10,
        updatedAt: 'baseline',
        slug: 'example',
        partners: [4],
        title: 'Old title',
        deliveredBy: 'Example university',
      },
    ],
    people: [
      { id: 20, updatedAt: 'baseline', name: 'Dr Example', role: 'Lead', bio: 'Preserved bio' },
    ],
    pages: [{ id: 30, updatedAt: 'baseline', slug: 'about', layout: [], _status: 'published' }],
    media: [
      { id: 5, updatedAt: 'baseline', filename: 'example-slides.pdf', mimeType: 'application/pdf' },
      { id: 6, updatedAt: 'baseline', filename: 'example-photo.png', mimeType: 'image/png' },
    ],
  }
  /** What Media serves, by filename. */
  const files = new Map<string, Buffer>()
  let sequence = 0
  let failReadback = false
  // Like Payload: a row written with an ID the record does not hold gets a new one.
  let reissueNewRowIds = false
  let reissued = 0
  let mutateAfterCreation = false
  let loseCreateResponse = false
  let loseUploadResponse = false
  let renameUpload = false
  const writes: string[] = []
  const client: CmsClient = {
    login: vi.fn(),
    dispose: vi.fn(),
    page: vi.fn(),
    probe: vi.fn(),
    upload: vi.fn((_path, file, data) => {
      // Payload gives a taken name a numeric suffix rather than replace a file.
      const filename = renameUpload ? file.filename.replace(/\.pdf$/, '-1.pdf') : file.filename
      const doc: Doc = {
        ...data,
        id: 77,
        updatedAt: `write-${++sequence}`,
        filename,
        mimeType: file.mimeType,
        filesize: file.bytes.length,
      }
      state.media.push(doc)
      files.set(filename, file.bytes)
      writes.push('upload media')
      if (loseUploadResponse) {
        loseUploadResponse = false
        throw new Error('Response lost')
      }
      return { doc: structuredClone(doc) }
    }),
    download: vi.fn((path) => {
      const bytes = files.get(decodeURIComponent(path.replace('/api/media/file/', '')))
      if (!bytes) throw new Error('vercel curl failed (exit 22)')
      return bytes
    }),
    api: vi.fn((path, method = 'GET', data) => {
      const url = new URL(path, 'https://example.invalid')
      const collection = url.pathname.split('/')[2]
      const docs = state[collection]
      if (method === 'POST') {
        const doc: Doc = { ...(data as object), id: 99, updatedAt: `write-${++sequence}` }
        docs.push(doc)
        writes.push('create partner')
        if (mutateAfterCreation) state.people[0].bio = 'Editor changed the bio during the run'
        if (loseCreateResponse) {
          loseCreateResponse = false
          throw new Error('Response lost')
        }
        return { doc: structuredClone(doc) }
      }
      if (method === 'PATCH') {
        const doc = docs.find(
          (doc) =>
            String(doc.id) === url.searchParams.get('where[and][0][id][equals]') &&
            doc.updatedAt === url.searchParams.get('where[and][1][updatedAt][equals]'),
        )
        if (!doc) return { docs: [] }
        if (reissueNewRowIds) {
          const held = new Set<string>()
          const collect = (value: unknown) => {
            if (!value || typeof value !== 'object') return
            for (const [key, item] of Object.entries(value))
              if (key === 'id' && typeof item === 'string') held.add(item)
              else collect(item)
          }
          collect(doc)
          const reissue = (value: unknown) => {
            if (!value || typeof value !== 'object') return
            const node = value as Record<string, unknown>
            if (typeof node.id === 'string' && !held.has(node.id))
              node.id = `reissued-${++reissued}`
            Object.values(node).forEach(reissue)
          }
          data = structuredClone(data)
          reissue(data)
        }
        Object.assign(doc, data, { updatedAt: `write-${++sequence}` })
        writes.push(collection)
        return { docs: [structuredClone(doc)] }
      }
      if (failReadback && collection === 'workstreams' && writes.includes('workstreams'))
        throw new Error('Readback unavailable')
      const filters = [...url.searchParams].filter(([key]) => key.endsWith('[equals]'))
      const ids = url.searchParams.get('where[id][in]')?.split(',')
      const hits = docs.filter((doc) =>
        ids
          ? ids.includes(String(doc.id))
          : filters.some(
              ([key, value]) =>
                doc[
                  key.includes('[filename]') ? 'filename' : key.includes('[name]') ? 'name' : 'slug'
                ] === value,
            ),
      )
      return { totalDocs: hits.length, docs: structuredClone(hits) }
    }),
  }
  return {
    state,
    files,
    writes,
    client,
    loseUploadResponse: () => {
      loseUploadResponse = true
    },
    renameUpload: () => {
      renameUpload = true
    },
    failReadback: () => {
      failReadback = true
    },
    reissueNewRowIds: () => {
      reissueNewRowIds = true
    },
    mutateAfterCreation: () => {
      mutateAfterCreation = true
    },
    loseCreateResponse: () => {
      loseCreateResponse = true
    },
  }
}

const directories: string[] = []
const options = () => {
  const backupDir = mkdtempSync(join(tmpdir(), 'mhg-runner-test-'))
  directories.push(backupDir)
  return { apply: true, allowProduction: true, backupDir, log: vi.fn() }
}
const receipt = (dir: string) => JSON.parse(readFileSync(join(dir, readdirSync(dir)[0]), 'utf8'))
afterEach(() => {
  directories.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }))
})

describe('reviewed CMS write sequence', () => {
  it('dry runs every operation without content writes', () => {
    const f = fixture()
    const original = structuredClone(f.state)
    runContentPatch(f.client, deployment, plan, { apply: false, log: vi.fn() })
    expect(f.state).toEqual(original)
    expect(f.writes).toEqual([])
  })

  it('creates one partner, resolves all placements, corrects an existing name and reruns without writes', () => {
    const f = fixture()
    const opts = options()
    const resolved = runContentPatch(f.client, deployment, plan, opts)
    expect(f.writes).toEqual(['create partner', 'workstreams', 'people', 'pages'])
    expect(f.state.workstreams[0]).toMatchObject({
      partners: [4, 99],
      deliveredBy: 'Example university',
    })
    expect(f.state.people).toHaveLength(1)
    expect(f.state.people[0]).toMatchObject({ name: 'Prof. Example', bio: 'Preserved bio' })
    expect(f.state.pages[0].layout).toEqual([{ blockType: 'partnerLogos', partners: [4, 99] }])
    expect(resolved.createPartners).toBeUndefined()
    expect(JSON.stringify(resolved)).not.toContain(reference)
    expect(
      receipt(opts.backupDir).writes.every(
        (write: { status: string }) => write.status === 'verified',
      ),
    ).toBe(true)
    f.writes.length = 0
    runContentPatch(f.client, deployment, plan, options())
    expect(f.writes).toEqual([])
  })

  it.each(['editor change', 'draft', 'partner identity', 'duplicate partner'])(
    'refuses %s before any content write',
    (scenario) => {
      const f = fixture()
      if (scenario === 'editor change') f.state.people[0].role = 'A newer role'
      if (scenario === 'draft') f.state.pages[0]._status = 'draft'
      if (scenario === 'partner identity')
        f.state.partners.push({
          ...partner.data,
          id: 99,
          updatedAt: 'baseline',
          url: 'https://different.example/',
        })
      if (scenario === 'duplicate partner')
        f.state.partners.push(
          ...[99, 100].map((id) => ({ ...partner.data, id, updatedAt: 'baseline' })),
        )
      const before = structuredClone(f.state)
      expect(() => runContentPatch(f.client, deployment, plan, options())).toThrow()
      expect(f.writes).toEqual([])
      expect(f.state).toEqual(before)
    },
  )

  it('fences an unrelated mid-run edit and preserves a truthful partial receipt', () => {
    const f = fixture()
    f.mutateAfterCreation()
    const opts = options()
    expect(() => runContentPatch(f.client, deployment, plan, opts)).toThrow(/changed during/)
    expect(f.writes).toEqual(['create partner', 'workstreams'])
    expect(f.state.people[0].bio).toContain('Editor changed')
    expect(receipt(opts.backupDir).state).toContain('stopped')
    expect(receipt(opts.backupDir).writes).toHaveLength(2)
  })

  it('records a successful write when its readback fails', () => {
    const f = fixture()
    f.failReadback()
    const opts = options()
    expect(() => runContentPatch(f.client, deployment, plan, opts)).toThrow(/Readback/)
    expect(receipt(opts.backupDir).writes[1].status).toBe('written')
  })

  it('recovers a lost creation response by reusing the exact partner on rerun', () => {
    const f = fixture()
    f.loseCreateResponse()
    const opts = options()
    expect(() => runContentPatch(f.client, deployment, plan, opts)).toThrow(/Response lost/)
    expect(receipt(opts.backupDir).writes[0].status).toBe('in flight')
    runContentPatch(f.client, deployment, plan, options())
    expect(f.state.partners).toHaveLength(1)
    expect(f.writes.filter((write) => write === 'create partner')).toHaveLength(1)
  })

  it('requires the production flag and keeps created partners when reversing updates', () => {
    const f = fixture()
    expect(() =>
      runContentPatch(f.client, deployment, plan, { ...options(), allowProduction: false }),
    ).toThrow(/allow-production/)
    expect(f.writes).toEqual([])
    runContentPatch(f.client, deployment, plan, options())
    runContentPatch(f.client, deployment, plan, { ...options(), reverse: true })
    expect(f.state.partners).toHaveLength(1)
    expect(f.state.people[0].name).toBe('Dr Example')
    expect(f.state.workstreams[0].partners).toEqual([4])
  })
})

describe('links to files in Media', () => {
  const fileLink = (id: number) => ({
    type: 'link',
    fields: { linkType: 'internal', newTab: false, doc: { relationTo: 'media', value: id } },
    children: [{ type: 'text', text: 'Example slides' }],
  })
  const linking = (id: number): ContentPlan => ({
    version: 1,
    name: 'Invented file link',
    changes: [
      {
        collection: 'pages',
        match: { field: 'slug', value: 'about' },
        before: { layout: [] },
        after: {
          layout: [
            {
              blockType: 'content',
              columns: [{ richText: { root: { type: 'root', children: [fileLink(id)] } } }],
            },
          ],
        },
      },
    ],
  })

  it('finds every linked file before writing, and names it in the log', () => {
    const f = fixture()
    const opts = options()
    runContentPatch(f.client, deployment, linking(5), opts)
    expect(f.writes).toEqual(['pages'])
    expect(opts.log).toHaveBeenCalledWith('file found: media/example-slides.pdf (#5)')
  })

  it.each([
    [404, /missing from Media: #404/],
    [6, /not a PDF: media\/example-photo.png/],
  ])('refuses a link to Media #%s before any content write', (id, message) => {
    const f = fixture()
    const before = structuredClone(f.state)
    expect(() => runContentPatch(f.client, deployment, linking(id), options())).toThrow(message)
    expect(f.writes).toEqual([])
    expect(f.state).toEqual(before)
  })

  it('reverses a file link without needing the file', () => {
    const f = fixture()
    runContentPatch(f.client, deployment, linking(5), options())
    f.state.media = []
    runContentPatch(f.client, deployment, linking(5), { ...options(), reverse: true })
    expect(f.state.pages[0].layout).toEqual([])
  })
})

describe('rows a plan adds', () => {
  const minted = 'a1b2c3d4e5f6a1b2c3d4e5f6'
  const adding: ContentPlan = {
    version: 1,
    name: 'Invented new row',
    changes: [
      {
        collection: 'pages',
        match: { field: 'slug', value: 'about' },
        before: { layout: [] },
        after: { layout: [{ id: minted, blockType: 'content', columns: [] }] },
        generatedIds: [minted],
      },
    ],
  }

  it('reverses a change that added rows with minted IDs', () => {
    const f = fixture()
    f.reissueNewRowIds()
    runContentPatch(f.client, deployment, adding, options())
    expect(f.state.pages[0].layout).toHaveLength(1)
    const reversed = runContentPatch(f.client, deployment, adding, { ...options(), reverse: true })
    expect(f.state.pages[0].layout).toEqual([])
    // What content:verify is then given must pass its own validation.
    expect(validatePlan(reversed).changes[0].generatedIds).toBeUndefined()
  })
})

describe('rows a plan removes', () => {
  const removing: ContentPlan = {
    version: 1,
    name: 'Invented row removal',
    changes: [
      {
        collection: 'pages',
        match: { field: 'slug', value: 'about' },
        before: {
          layout: [
            { id: 'kept-row', blockType: 'content', columns: [] },
            { id: 'old-row', blockType: 'content', columns: [] },
          ],
        },
        after: { layout: [{ id: 'kept-row', blockType: 'content', columns: [] }] },
      },
    ],
  }

  it('reverses a removal although the restored row gets a new ID', () => {
    const f = fixture()
    f.state.pages[0].layout = structuredClone(removing.changes[0].before.layout)
    f.reissueNewRowIds()
    runContentPatch(f.client, deployment, removing, options())
    expect(f.state.pages[0].layout).toHaveLength(1)
    const reversed = runContentPatch(f.client, deployment, removing, {
      ...options(),
      reverse: true,
    })
    expect(f.state.pages[0].layout).toHaveLength(2)
    expect((f.state.pages[0].layout as { id: string }[])[1].id).toMatch(/^reissued-/)
    expect(validatePlan(reversed).changes[0].generatedIds).toEqual(['old-row'])
  })
})

describe('files a plan uploads', () => {
  const pdf = Buffer.from('%PDF-1.4\ninvented slides\nxref\n%%EOF\n')
  const reference = '__MEDIA_EXAMPLE__'
  const upload = {
    reference,
    file: 'files/Example slides v3.pdf',
    filename: 'example-new-slides.pdf',
    alt: 'Invented slides',
    mimeType: 'application/pdf' as const,
    filesize: pdf.length,
    sha256: createHash('sha256').update(pdf).digest('hex'),
  }
  const fileLink = (value: number | string) => ({
    type: 'link',
    fields: { linkType: 'internal', newTab: false, doc: { relationTo: 'media', value } },
    children: [{ type: 'text', text: 'Invented slides' }],
  })
  const layout = (value: number | string) => [
    {
      blockType: 'content',
      columns: [{ richText: { root: { type: 'root', children: [fileLink(value)] } } }],
    },
  ]
  const uploading: ContentPlan = {
    version: 1,
    name: 'Invented upload',
    uploadMedia: [upload],
    changes: [
      {
        collection: 'pages',
        match: { field: 'slug', value: 'about' },
        before: { layout: [] },
        after: { layout: layout(reference) },
      },
    ],
  }
  const planDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'mhg-upload-test-'))
    directories.push(dir)
    mkdirSync(join(dir, 'files'))
    writeFileSync(join(dir, upload.file), pdf)
    return dir
  }
  const uploadOptions = () => ({ ...options(), planDir: planDir() })

  it('dry runs: names the upload and writes nothing', () => {
    const f = fixture()
    const log = vi.fn()
    const plan = runContentPatch(f.client, deployment, uploading, {
      apply: false,
      planDir: planDir(),
      log,
    })
    expect(log).toHaveBeenCalledWith(
      'ready to upload: media/example-new-slides.pdf (1 KB) from files/Example slides v3.pdf',
    )
    expect(log).toHaveBeenCalledWith('ready: pages/about [layout]')
    expect(plan.uploadMedia?.[0].id).toBeUndefined()
    expect(f.writes).toEqual([])
    expect(f.client.upload).not.toHaveBeenCalled()
  })

  it('uploads before any record write, links the new file, and reruns without writes', () => {
    const f = fixture()
    const opts = uploadOptions()
    const resolved = runContentPatch(f.client, deployment, uploading, opts)
    expect(f.writes).toEqual(['upload media', 'pages'])
    expect(f.client.upload).toHaveBeenCalledWith(
      '/api/media?depth=0',
      { bytes: pdf, filename: 'example-new-slides.pdf', mimeType: 'application/pdf' },
      { alt: 'Invented slides' },
    )
    expect(f.state.pages[0].layout).toEqual(layout(77))
    expect(resolved.uploadMedia).toEqual([{ ...upload, id: 77 }])
    expect(JSON.stringify(resolved.changes)).not.toContain(reference)
    const writes = receipt(opts.backupDir).writes
    expect(
      writes.map((w: { collection: string; status: string }) => [w.collection, w.status]),
    ).toEqual([
      ['media', 'verified'],
      ['pages', 'verified'],
    ])
    f.writes.length = 0
    const rerun = uploadOptions()
    runContentPatch(f.client, deployment, uploading, rerun)
    expect(f.writes).toEqual([])
    expect(rerun.log).toHaveBeenCalledWith(
      'already in Media: media/example-new-slides.pdf (#77), the reviewed file',
    )
  })

  it.each(['different bytes', 'different size'])(
    'refuses another file under the same name (%s) before any write',
    (scenario) => {
      const f = fixture()
      const other =
        scenario === 'different bytes'
          ? Buffer.from('%PDF-1.4\ninvented other!\nxref\n%%EOF\n')
          : Buffer.from('%PDF-1.4\nlonger, invented other slides\nxref\n%%EOF\n')
      f.state.media.push({
        id: 8,
        updatedAt: 'baseline',
        filename: upload.filename,
        mimeType: 'application/pdf',
        filesize: other.length,
      })
      f.files.set(upload.filename, other)
      const before = structuredClone(f.state)
      expect(() => runContentPatch(f.client, deployment, uploading, uploadOptions())).toThrow(
        /different file named example-new-slides.pdf is already in Media \(#8\)/,
      )
      expect(f.writes).toEqual([])
      expect(f.state).toEqual(before)
    },
  )

  it('refuses a local file changed since review before any write', () => {
    const f = fixture()
    const opts = uploadOptions()
    writeFileSync(join(opts.planDir, upload.file), Buffer.concat([pdf, Buffer.from('\n')]))
    expect(() => runContentPatch(f.client, deployment, uploading, opts)).toThrow(
      /changed since the plan was reviewed/,
    )
    expect(f.writes).toEqual([])
  })

  it('recovers a lost upload response by reusing the uploaded file on rerun', () => {
    const f = fixture()
    f.loseUploadResponse()
    const opts = uploadOptions()
    expect(() => runContentPatch(f.client, deployment, uploading, opts)).toThrow(/Response lost/)
    expect(receipt(opts.backupDir).writes).toMatchObject([
      { collection: 'media', status: 'in flight' },
    ])
    expect(f.writes).toEqual(['upload media'])
    runContentPatch(f.client, deployment, uploading, uploadOptions())
    expect(f.writes).toEqual(['upload media', 'pages'])
    expect(f.state.media.filter((doc) => doc.filename === upload.filename)).toHaveLength(1)
  })

  it('stops, with a truthful receipt, when Media saves the file under another name', () => {
    const f = fixture()
    f.renameUpload()
    const opts = uploadOptions()
    expect(() => runContentPatch(f.client, deployment, uploading, opts)).toThrow(
      /as example-new-slides-1.pdf/,
    )
    expect(receipt(opts.backupDir).writes).toMatchObject([
      { collection: 'media', status: 'uploaded', id: 77, savedAs: 'example-new-slides-1.pdf' },
    ])
    expect(f.writes).toEqual(['upload media'])
  })

  it('reverses the links and keeps the uploaded file', () => {
    const f = fixture()
    runContentPatch(f.client, deployment, uploading, uploadOptions())
    f.writes.length = 0
    runContentPatch(f.client, deployment, uploading, { ...uploadOptions(), reverse: true })
    expect(f.writes).toEqual(['pages'])
    expect(f.state.pages[0].layout).toEqual([])
    expect(f.state.media.find((doc) => doc.filename === upload.filename)).toBeTruthy()
    const missing = fixture()
    expect(() =>
      runContentPatch(missing.client, deployment, uploading, { ...uploadOptions(), reverse: true }),
    ).toThrow(/missing from Media/)
    expect(missing.client.upload).not.toHaveBeenCalled()
  })
})
