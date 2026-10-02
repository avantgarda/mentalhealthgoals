// @vitest-environment node
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CmsClient, Deployment } from '../../scripts/lib/cms-client'
import type { ContentPlan } from '../../scripts/lib/content-patch-core'
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
  }
  let sequence = 0
  let failReadback = false
  let mutateAfterCreation = false
  let loseCreateResponse = false
  const writes: string[] = []
  const client: CmsClient = {
    login: vi.fn(),
    dispose: vi.fn(),
    page: vi.fn(),
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
        Object.assign(doc, data, { updatedAt: `write-${++sequence}` })
        writes.push(collection)
        return { docs: [structuredClone(doc)] }
      }
      if (failReadback && collection === 'workstreams' && writes.includes('workstreams'))
        throw new Error('Readback unavailable')
      const filters = [...url.searchParams].filter(([key]) => key.endsWith('[equals]'))
      const hits = docs.filter((doc) =>
        filters.some(([key, value]) => doc[key.includes('[name]') ? 'name' : 'slug'] === value),
      )
      return { totalDocs: hits.length, docs: structuredClone(hits) }
    }),
  }
  return {
    state,
    writes,
    client,
    failReadback: () => {
      failReadback = true
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
