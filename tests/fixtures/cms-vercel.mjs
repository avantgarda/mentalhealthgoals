/** Offline Vercel/Payload transport for CLI regression tests. Invented content
 * only; this process never opens a network or database connection. */
import { readFileSync, writeFileSync, statSync } from 'node:fs'

const file = process.env.MHG_TEST_CMS_STATE
if (!file) throw new Error('Offline CMS state required')
const state = JSON.parse(readFileSync(file, 'utf8'))
const args = process.argv.slice(2)
const save = () => writeFileSync(file, JSON.stringify(state))
const out = (value) => process.stdout.write(JSON.stringify(value))
if (args.includes('api')) {
  if (args[0] !== '--scope' || args[1] !== 'team_fixture') process.exit(2)
  out({
    projectId: 'project_fixture',
    readyState: 'READY',
    target: state.environment ?? 'production',
  })
} else if (args[0] === 'curl') {
  if (args.includes('--scope')) process.exit(2)
  const path = args[1]
  const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
  const forms = args.flatMap((arg, i) =>
    arg === '--form' || arg === '--form-string' ? [args[i + 1]] : [],
  )
  const method = flag('--request') ?? (forms.length ? 'POST' : 'GET')
  const config = flag('--config')
  if (config && (statSync(config).mode & 0o777) !== 0o600) process.exit(3)
  // Real curl would send a multipart body under a configured JSON type.
  if (forms.length && config && readFileSync(config, 'utf8').includes('Content-Type'))
    process.exit(3)
  const body = args.includes('--data-binary')
    ? args[args.indexOf('--data-binary') + 1].slice(1)
    : undefined
  if (body && (statSync(body).mode & 0o777) !== 0o600) process.exit(3)
  const data = body ? JSON.parse(readFileSync(body, 'utf8')) : undefined
  state.requests.push({ path, method })
  if (path === '/api/users/login') {
    save()
    if (state.loginFailure) {
      process.stdout.write('offline-token offline-password')
      process.stderr.write('offline-token offline-password')
      process.exit(22)
    }
    out({ token: 'offline-token', user: { id: 1 } })
  } else if (path === '/api/users/logout') {
    save()
    out({ ok: true })
  } else if (path.startsWith('/api/media/file/')) {
    // Payload's file route: ranged GETs answer 206 with the full size in
    // Content-Range.
    const stored = state.files?.[decodeURIComponent(path.slice('/api/media/file/'.length))]
    const bytes = stored === undefined ? undefined : Buffer.from(stored, 'base64')
    const ranged = bytes && flag('--range') === '0-0'
    const status = !bytes ? 404 : ranged ? 206 : 200
    const headers = [`HTTP/2 ${status}`]
    if (bytes)
      headers.push(
        'content-type: application/pdf',
        ranged ? `content-range: bytes 0-0/${bytes.length}` : `content-length: ${bytes.length}`,
      )
    if (flag('--dump-header'))
      writeFileSync(flag('--dump-header'), `${headers.join('\r\n')}\r\n\r\n`)
    const body = !bytes ? Buffer.alloc(0) : ranged ? bytes.subarray(0, 1) : bytes
    if (flag('--output')) writeFileSync(flag('--output'), body)
    else process.stdout.write(body)
    save()
    if (!bytes && (args.includes('--fail') || args.includes('--fail-with-body'))) process.exit(22)
  } else if (path.startsWith('/api/') && forms.length) {
    // A multipart upload: `file=@<path>;type=…;filename=…` and `_payload`.
    const [source, ...parameters] = forms
      .find((form) => form.startsWith('file=@'))
      .slice('file=@'.length)
      .split(';')
    if ((statSync(source).mode & 0o777) !== 0o600) process.exit(3)
    const parameter = (name) =>
      parameters.find((p) => p.startsWith(`${name}=`))?.slice(name.length + 1)
    const payload = JSON.parse(
      forms.find((form) => form.startsWith('_payload=')).slice('_payload='.length),
    )
    const bytes = readFileSync(source)
    const filename = parameter('filename')
    state.files = { ...state.files, [filename]: bytes.toString('base64') }
    const doc = {
      ...payload,
      id: 77,
      filename,
      mimeType: parameter('type'),
      filesize: bytes.length,
      url: `/api/media/file/${filename}`,
      updatedAt: 'created',
    }
    state.collections.media.push(doc)
    save()
    out({ doc })
  } else if (path.startsWith('/api/')) {
    const url = new URL(path, 'https://example.invalid')
    const collection = url.pathname.split('/')[2]
    const docs = state.collections[collection]
    if (!docs) process.exit(22)
    if (url.pathname.endsWith('/versions')) {
      save()
      out({ totalDocs: 1, docs: [{ id: 1 }] })
    } else if (method === 'POST') {
      const doc = { ...data, id: 99, updatedAt: 'created' }
      docs.push(doc)
      save()
      out({ doc })
    } else if (method === 'PATCH') {
      const doc = docs.find(
        (doc) =>
          String(doc.id) === url.searchParams.get('where[and][0][id][equals]') &&
          doc.updatedAt === url.searchParams.get('where[and][1][updatedAt][equals]'),
      )
      if (!doc) {
        save()
        out({ docs: [] })
      } else {
        Object.assign(doc, data, { updatedAt: `${doc.updatedAt}-updated` })
        save()
        out({ docs: [doc] })
      }
    } else {
      const filters = [...url.searchParams].filter(
        ([key]) => key.endsWith('[equals]') || key.endsWith('[in]'),
      )
      const field = (key) =>
        key.includes('[filename]')
          ? 'filename'
          : key.includes('[name]')
            ? 'name'
            : key.includes('[id]')
              ? 'id'
              : 'slug'
      const hits = filters.length
        ? docs.filter((doc) =>
            filters.some(([key, value]) =>
              key.endsWith('[in]')
                ? value.split(',').includes(String(doc[field(key)]))
                : String(doc[field(key)]) === value,
            ),
          )
        : docs
      save()
      out({
        totalDocs: hits.length,
        docs: hits.slice(0, Number(url.searchParams.get('limit') ?? 500)),
      })
    }
  } else {
    const slug = path === '/' ? 'home' : path.slice(1)
    const status =
      path === '/people' ||
      path === '/workstreams' ||
      state.collections.pages.some((doc) => doc.slug === slug) ||
      state.collections.workstreams.some((doc) => path === `/workstreams/${doc.slug}`)
        ? 200
        : 404
    const prose = new Set([
      'title',
      'name',
      'role',
      'bio',
      'summary',
      'description',
      'heading',
      'text',
      'label',
    ])
    // A link to a file in Media, as `RichText/links.tsx` renders it.
    const size = (bytes) =>
      Math.round(bytes / 1e3) >= 1000
        ? `${(bytes / 1e6).toFixed(1)} MB`
        : `${Math.max(Math.round(bytes / 1e3), 1)} KB`
    const walk = (value, key) => {
      if (typeof value === 'string') return prose.has(key) ? value : ''
      if (Array.isArray(value)) return value.map((entry) => walk(entry, key)).join(' ')
      if (!value || typeof value !== 'object') return ''
      if (value.type === 'link' && value.fields?.doc?.relationTo === 'media') {
        const file = state.collections.media.find(
          (doc) => String(doc.id) === String(value.fields.doc.value),
        )
        const words = walk(value.children, 'children').trim()
        return file ? `<a href="${file.url}">${words} (PDF, ${size(file.filesize)})</a>` : words
      }
      return Object.entries(value)
        .map(([key, entry]) => (key === 'url' ? `<a href="${entry}">Link</a>` : walk(entry, key)))
        .join(' ')
    }
    const html = state.badPage
      ? '<p>Missing revised copy</p>'
      : `<p>${walk(Object.entries(state.collections).flatMap(([name, docs]) => (name === 'media' ? [] : docs)))}</p>`
    save()
    process.stdout.write(`${html}\n${status}`)
  }
} else process.exit(2)
