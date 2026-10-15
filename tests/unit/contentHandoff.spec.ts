// @vitest-environment node
import { spawn, spawnSync } from 'node:child_process'
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
    const pdf = Buffer.from('%PDF-1.4\ninvented slides\nxref\n%%EOF\n')
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

  // One invented PDF, uploaded and linked from the About page.
  const declareSlides = (f: ReturnType<typeof fixture>) => {
    const pdf = Buffer.from('%PDF-1.4\ninvented slides\nxref\n%%EOF\n')
    mkdirSync(join(f.dir, 'files'))
    writeFileSync(join(f.dir, 'files/slides.pdf'), pdf)
    const link = (value: number | string) => ({
      type: 'link',
      fields: { linkType: 'internal', doc: { relationTo: 'media', value } },
      children: [{ type: 'text', text: 'Invented slides' }],
    })
    writeFileSync(
      f.planFile,
      JSON.stringify({
        version: 1,
        name: 'Invented upload',
        uploadMedia: [
          {
            reference: '__MEDIA_SLIDES__',
            file: 'files/slides.pdf',
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
            after: {
              layout: [
                {
                  blockType: 'content',
                  columns: [
                    { richText: { root: { type: 'root', children: [link('__MEDIA_SLIDES__')] } } },
                  ],
                },
              ],
            },
          },
        ],
      }),
    )
  }
  const login = 'editor@example.org\noffline-password\n'

  it('says why Media refused an upload, and writes nothing else', () => {
    const f = fixture({
      uploadRefusal: {
        status: 400,
        body: { errors: [{ message: 'The file you uploaded was not a valid PDF.' }] },
      },
    })
    declareSlides(f)
    const result = f.run(['--apply', '--allow-production'], login)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(
      'Media refused the upload (HTTP 400): The file you uploaded was not a valid PDF.',
    )
    expect(f.state().collections.media).toHaveLength(1)
    expect(f.state().collections.pages[0].layout).toEqual([])
  }, 60_000)

  it('waits for a file Media lists but does not yet serve, then reuses it', () => {
    const f = fixture({ unservedFiles: true })
    declareSlides(f)
    const first = f.run(['--apply', '--allow-production'], login)
    expect(first.status).not.toBe(0)
    expect(first.stderr).toContain('Upload read-back failed: example-new-slides.pdf is in Media')
    expect(first.stderr).toContain('Run the same command again in a minute')
    expect(f.state().collections.pages[0].layout).toEqual([])
    // Still not served: the rerun says so, not that another file has the name.
    const second = f.run(['--apply', '--allow-production'], login)
    expect(second.stderr).toContain('did not serve it in full (Media served HTTP 204')
    expect(second.stderr).not.toContain('A different file')
    const state = f.state()
    state.unservedFiles = false
    writeFileSync(f.env.MHG_TEST_CMS_STATE, JSON.stringify(state))
    const third = f.run(['--apply', '--allow-production'], login)
    expect(third.status, third.stdout + third.stderr).toBe(0)
    expect(third.stdout).toContain('already in Media: media/example-new-slides.pdf (#77)')
    expect(f.state().collections.media).toHaveLength(2)
  }, 60_000)

  it('ends the session and removes its files when stopped with Ctrl-C', async () => {
    const f = fixture({ slowUpload: true })
    declareSlides(f)
    const temporary = mkdtempSync(join(tmpdir(), 'mhg-handoff-tmp-'))
    directories.push(temporary)
    const child = spawn(
      'bash',
      ['scripts/content-run.sh', '--plan', f.planFile, '--apply', '--allow-production'],
      { cwd: f.dir, env: { ...f.env, TMPDIR: temporary }, detached: true },
    )
    child.stdin.end(login)
    let stderr = ''
    child.stderr.on('data', (chunk) => (stderr += chunk))
    const exited = new Promise<number | null>((done) => child.on('exit', (code) => done(code)))
    const posted = () =>
      f
        .state()
        .requests.some(
          (r: { path: string; method: string }) =>
            r.method === 'POST' && r.path.startsWith('/api/media'),
        )
    for (let i = 0; i < 200 && !posted(); i++) await new Promise((r) => setTimeout(r, 100))
    expect(posted()).toBe(true)
    // Ctrl-C reaches the terminal's whole foreground group.
    process.kill(-child.pid!, 'SIGINT')
    expect(await exited).not.toBe(0)
    const loggedOut = () =>
      f.state().requests.some((r: { path: string }) => r.path === '/api/users/logout')
    for (let i = 0; i < 100 && !loggedOut(); i++) await new Promise((r) => setTimeout(r, 100))
    expect(loggedOut(), stderr).toBe(true)
    expect(stderr).toContain('was stopped (SIGINT); the run stops here')
    expect(readdirSync(temporary).filter((name) => name.startsWith('mhg-cms-'))).toEqual([])
    expect(f.state().collections.pages[0].layout).toEqual([])
  }, 60_000)

  it('verifies a reversal of a plan that adds and removes rows', () => {
    const minted = 'a1b2c3d4e5f6a1b2c3d4e5f6'
    const row = (id: string) => ({ id, blockType: 'content', columns: [] })
    const f = fixture()
    const state = f.state()
    state.collections.pages[0].layout = [row('kept-row'), row('old-row')]
    writeFileSync(f.env.MHG_TEST_CMS_STATE, JSON.stringify(state))
    writeFileSync(
      f.planFile,
      JSON.stringify({
        version: 1,
        name: 'Invented rows',
        changes: [
          {
            collection: 'pages',
            match: { field: 'slug', value: 'about' },
            before: { layout: [row('kept-row'), row('old-row')] },
            after: { layout: [row('kept-row'), row(minted)] },
            generatedIds: [minted],
          },
        ],
      }),
    )
    const input = 'editor@example.org\noffline-password\n'
    const ok = (args: string[]) => {
      const result = f.run(args, input)
      expect(result.status, result.stdout + result.stderr).toBe(0)
    }
    ok(['--apply', '--allow-production'])
    ok(['--verify-only'])
    ok(['--apply', '--allow-production', '--reverse'])
    ok(['--verify-only', '--reverse'])
    expect(f.state().collections.pages[0].layout.map((r: { id: string }) => r.id)).toEqual([
      'kept-row',
      'old-row',
    ])
    for (const run of readdirSync(join(f.dir, 'backups')))
      expect(
        JSON.parse(readFileSync(join(f.dir, 'backups', run, 'run.json'), 'utf8'))
          .automatedVerification,
      ).toBe('passed')
  }, 60_000)

  it('stops at preflight, before the login, on a different file under the same name', () => {
    const f = fixture()
    const pdf = Buffer.from('%PDF-1.4\ninvented slides\nxref\n%%EOF\n')
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
