// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const repo = resolve('.')
const directories: string[] = []
const plan = {
  version: 1,
  name: 'Invented handoff',
  changes: [
    {
      collection: 'people',
      match: { field: 'name', value: 'Dr Example' },
      before: { name: 'Dr Example', role: 'Lead' },
      after: { name: 'Prof. Example', role: 'Co-lead' },
    },
  ],
}
const quote = (s: string) => `'${s.replaceAll("'", "'\\''")}'`
function fixture(settings: Record<string, unknown> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'mhg-handoff-test-'))
  directories.push(dir)
  mkdirSync(join(dir, '.vercel'))
  mkdirSync(join(dir, 'scripts'))
  mkdirSync(join(dir, 'bin'))
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}')
  writeFileSync(
    join(dir, '.vercel/project.json'),
    JSON.stringify({ orgId: 'team_fixture', projectId: 'project_fixture' }),
  )
  symlinkSync(join(repo, 'node_modules'), join(dir, 'node_modules'), 'dir')
  for (const name of ['content-run.ts', 'content-verify.ts', 'content-snapshot.ts'])
    symlinkSync(join(repo, 'scripts', name), join(dir, 'scripts', name))
  copyFileSync(join(repo, 'scripts/content-run.sh'), join(dir, 'scripts/content-run.sh'))
  writeFileSync(
    join(dir, 'bin/vercel'),
    `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(join(repo, 'tests/fixtures/cms-vercel.mjs'))} "$@"\n`,
    { mode: 0o700 },
  )
  const stateFile = join(dir, 'state.json')
  writeFileSync(
    stateFile,
    JSON.stringify({
      requests: [],
      collections: {
        pages: [{ id: 10, slug: 'about', updatedAt: 'baseline', layout: [], _status: 'published' }],
        posts: [],
        workstreams: [],
        partners: [],
        people: [{ id: 20, name: 'Dr Example', role: 'Lead', updatedAt: 'baseline' }],
        media: [{ id: 5, filename: 'example-slides.pdf', mimeType: 'application/pdf' }],
      },
      ...settings,
    }),
  )
  const planFile = join(dir, 'plan.json')
  writeFileSync(planFile, JSON.stringify(plan))
  const env = {
    ...process.env,
    PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
    MHG_TEST_CMS_STATE: stateFile,
    MHG_CMS_EMAIL: '',
    MHG_CMS_PASSWORD: '',
  }
  const run = (args: string[], input?: string) =>
    spawnSync('bash', ['scripts/content-run.sh', '--plan', planFile, ...args], {
      cwd: dir,
      env,
      encoding: 'utf8',
      input,
      timeout: 30_000,
    })
  return { dir, env, planFile, run, state: () => JSON.parse(readFileSync(stateFile, 'utf8')) }
}
afterEach(() => {
  directories.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }))
})

describe('single-command CMS handoff', () => {
  it('validates locally and preflights real command transport without asking for credentials', () => {
    const f = fixture()
    expect(f.run(['--validate']).status).toBe(0)
    expect(f.state().requests).toHaveLength(0)
    const result = f.run(['--preflight'])
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('Preflight passed')
    expect(f.state().requests).toEqual([{ path: '/api/pages?depth=0&limit=1', method: 'GET' }])
  })

  it('prompts once, dry runs by default, and applies/verifies with a durable pending live review', () => {
    const f = fixture()
    const input = 'editor@example.org\noffline-password\n'
    expect(f.run([], input).status).toBe(0)
    expect(f.state().collections.people[0].name).toBe('Dr Example')
    const result = f.run(['--apply', '--allow-production'], input)
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toContain(
      'Live desktop/mobile and related-content review is still required',
    )
    expect(result.stdout + result.stderr).not.toContain('offline-password')
    expect(result.stdout + result.stderr).not.toContain('offline-token')
    expect(f.state().collections.people[0].name).toBe('Prof. Example')
    const runDir = join(f.dir, 'backups', readdirSync(join(f.dir, 'backups'))[0])
    expect(JSON.parse(readFileSync(join(runDir, 'run.json'), 'utf8'))).toMatchObject({
      automatedVerification: 'passed',
      liveWebsiteReview: 'pending',
    })
    const count = f.state().requests.filter((r: { method: string }) => r.method === 'PATCH').length
    expect(f.run(['--apply', '--allow-production'], input).status).toBe(0)
    expect(f.state().requests.filter((r: { method: string }) => r.method === 'PATCH')).toHaveLength(
      count,
    )
    expect(f.run(['--verify-only'], input).status).toBe(0)
    expect(f.state().requests.filter((r: { method: string }) => r.method === 'PATCH')).toHaveLength(
      count,
    )
  }, 30_000)

  it('requires the production flag before login, and preview still requires a canary', () => {
    const f = fixture()
    const result = f.run(['--apply'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('allow-production')
    expect(f.state().requests).toHaveLength(0)
    const preview = fixture({ environment: 'preview' })
    const refused = preview.run(
      ['--deployment', 'example-preview.vercel.app'],
      'editor@example.org\noffline-password\n',
    )
    expect(refused.status).not.toBe(0)
    expect(refused.stderr).toContain('temporary editor')
    expect(
      preview.state().requests.some((r: { path: string }) => r.path === '/api/users/login'),
    ).toBe(false)
  })

  it('refuses a default production alias that resolves to a preview before login', () => {
    const f = fixture({ environment: 'preview' })
    const result = f.run(['--preflight'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('permanent alias')
    expect(f.state().requests).toHaveLength(0)
  })

  it('stops a rejected login without echoing response secrets or writing content', () => {
    const f = fixture({ loginFailure: true })
    const result = f.run(
      ['--apply', '--allow-production'],
      'editor@example.org\noffline-password\n',
    )
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('CMS login failed')
    expect(result.stdout + result.stderr).not.toMatch(/offline-token|offline-password/)
    expect(f.state().requests.filter((r: { method: string }) => r.method === 'PATCH')).toHaveLength(
      0,
    )
  })

  it('reports failed website verification accurately after an apply', () => {
    const f = fixture({ badPage: true })
    const result = f.run(
      ['--apply', '--allow-production'],
      'editor@example.org\noffline-password\n',
    )
    expect(result.status).not.toBe(0)
    expect(f.state().collections.people[0].name).toBe('Prof. Example')
    const runDir = join(f.dir, 'backups', readdirSync(join(f.dir, 'backups'))[0])
    expect(JSON.parse(readFileSync(join(runDir, 'run.json'), 'utf8'))).toMatchObject({
      automatedVerification: 'failed',
      liveWebsiteReview: 'pending',
    })
  })

  it('uploads a declared file in the same command, links it, and checks it is served', () => {
    const f = fixture()
    const pdf = Buffer.from('%PDF-1.4\ninvented slides\n%%EOF\n')
    mkdirSync(join(f.dir, 'files'))
    writeFileSync(join(f.dir, 'files/Slides v3.pdf'), pdf)
    const layout = (value: number | string) => [
      {
        blockType: 'content',
        columns: [
          {
            richText: {
              root: {
                type: 'root',
                children: [
                  {
                    type: 'link',
                    fields: { linkType: 'internal', doc: { relationTo: 'media', value } },
                    children: [{ type: 'text', text: 'Invented slides' }],
                  },
                ],
              },
            },
          },
        ],
      },
    ]
    writeFileSync(
      f.planFile,
      JSON.stringify({
        version: 1,
        name: 'Invented upload',
        uploadMedia: [
          {
            reference: '__MEDIA_SLIDES__',
            file: 'files/Slides v3.pdf',
            filename: 'example-new-slides.pdf',
            alt: 'Invented slides',
            mimeType: 'application/pdf',
            filesize: pdf.length,
            sha256: createHash('sha256').update(pdf).digest('hex'),
          },
        ],
        changes: [
          {
            collection: 'pages',
            match: { field: 'slug', value: 'about' },
            before: { layout: [] },
            after: { layout: layout('__MEDIA_SLIDES__') },
          },
        ],
      }),
    )
    const validated = f.run(['--validate'])
    expect(validated.status, validated.stderr).toBe(0)
    expect(validated.stdout).toContain(
      'upload: media/example-new-slides.pdf (1 KB) from files/Slides v3.pdf',
    )
    expect(f.state().requests).toHaveLength(0)
    const preflight = f.run(['--preflight'])
    expect(preflight.status, preflight.stderr).toBe(0)
    expect(preflight.stdout).toContain('ready to upload: media/example-new-slides.pdf (1 KB)')
    expect(f.state().requests.every((r: { method: string }) => r.method === 'GET')).toBe(true)

    const input = 'editor@example.org\noffline-password\n'
    const uploads = () =>
      f
        .state()
        .requests.filter(
          (r: { path: string; method: string }) =>
            r.method === 'POST' && r.path.startsWith('/api/media'),
        )
    const applied = f.run(['--apply', '--allow-production'], input)
    expect(applied.status, applied.stdout + applied.stderr).toBe(0)
    expect(applied.stdout).toContain('Verified upload: media/example-new-slides.pdf (#77)')
    expect(uploads()).toHaveLength(1)
    expect(f.state().collections.media).toContainEqual(
      expect.objectContaining({
        id: 77,
        filename: 'example-new-slides.pdf',
        alt: 'Invented slides',
      }),
    )
    expect(f.state().collections.pages[0].layout).toEqual(layout(77))
    const runDir = join(f.dir, 'backups', readdirSync(join(f.dir, 'backups'))[0])
    const resolved = JSON.parse(readFileSync(join(runDir, 'resolved-plan.json'), 'utf8'))
    expect(resolved.uploadMedia[0].id).toBe(77)
    const verification = JSON.parse(readFileSync(join(runDir, 'verification.json'), 'utf8'))
    expect(verification.results).toContainEqual(
      expect.objectContaining({
        upload: 'example-new-slides.pdf',
        ok: true,
        status: 206,
        contentType: 'application/pdf',
        size: pdf.length,
      }),
    )
    expect(verification.failed).toBe(0)

    // A rerun, a verification and a reversal upload nothing and delete nothing.
    expect(f.run(['--apply', '--allow-production'], input).status).toBe(0)
    expect(f.run(['--verify-only'], input).status).toBe(0)
    const reversed = f.run(['--apply', '--allow-production', '--reverse'], input)
    expect(reversed.status, reversed.stdout + reversed.stderr).toBe(0)
    expect(uploads()).toHaveLength(1)
    expect(f.state().collections.pages[0].layout).toEqual([])
    expect(f.state().collections.media).toContainEqual(expect.objectContaining({ id: 77 }))
    expect(f.state().requests.some((r: { method: string }) => r.method === 'DELETE')).toBe(false)
  }, 60_000)

  it('stops at preflight, before the login, on a different file under the same name', () => {
    const f = fixture()
    const pdf = Buffer.from('%PDF-1.4\ninvented slides\n%%EOF\n')
    mkdirSync(join(f.dir, 'files'))
    writeFileSync(join(f.dir, 'files/slides.pdf'), pdf)
    writeFileSync(
      f.planFile,
      JSON.stringify({
        version: 1,
        name: 'Invented upload',
        uploadMedia: [
          {
            reference: '__MEDIA_SLIDES__',
            file: 'files/slides.pdf',
            filename: 'example-slides.pdf',
            alt: 'Invented slides',
            mimeType: 'application/pdf',
            filesize: pdf.length,
            sha256: createHash('sha256').update(pdf).digest('hex'),
          },
        ],
        changes: [
          {
            collection: 'pages',
            match: { field: 'slug', value: 'about' },
            before: { layout: [] },
            after: {
              layout: [
                {
                  blockType: 'content',
                  columns: [
                    {
                      richText: {
                        root: {
                          type: 'root',
                          children: [
                            {
                              type: 'link',
                              fields: {
                                linkType: 'internal',
                                doc: { relationTo: 'media', value: '__MEDIA_SLIDES__' },
                              },
                              children: [{ type: 'text', text: 'Invented slides' }],
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      }),
    )
    const state = JSON.parse(readFileSync(f.env.MHG_TEST_CMS_STATE, 'utf8'))
    state.collections.media[0].filesize = 9
    state.files = { 'example-slides.pdf': Buffer.from('%PDF-old!').toString('base64') }
    writeFileSync(f.env.MHG_TEST_CMS_STATE, JSON.stringify(state))
    const result = f.run(
      ['--apply', '--allow-production'],
      'editor@example.org\noffline-password\n',
    )
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(
      'A different file named example-slides.pdf is already in Media (#5)',
    )
    expect(f.state().requests.some((r: { path: string }) => r.path === '/api/users/login')).toBe(
      false,
    )
    expect(f.state().requests.every((r: { method: string }) => r.method === 'GET')).toBe(true)
  })

  it('takes a public snapshot including partners and Media without a CMS login', () => {
    const f = fixture()
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'scripts/content-snapshot.ts',
        '--deployment',
        'example.vercel.app',
        '--dir',
        'snapshot',
        '--public',
      ],
      { cwd: f.dir, env: f.env, encoding: 'utf8' },
    )
    expect(result.status, result.stderr).toBe(0)
    expect(readdirSync(join(f.dir, 'snapshot/sources'))).toContain('partners.json')
    expect(
      JSON.parse(readFileSync(join(f.dir, 'snapshot/sources/media.json'), 'utf8')),
    ).toMatchObject([{ id: 5, filename: 'example-slides.pdf' }])
    expect(f.state().requests.some((r: { path: string }) => r.path === '/api/users/login')).toBe(
      false,
    )
  })
})
