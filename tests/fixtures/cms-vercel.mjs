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
  const method = args.includes('--request') ? args[args.indexOf('--request') + 1] : 'GET'
  const config = args.includes('--config') ? args[args.indexOf('--config') + 1] : undefined
  if (config && (statSync(config).mode & 0o777) !== 0o600) process.exit(3)
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
      const filters = [...url.searchParams].filter(([key]) => key.endsWith('[equals]'))
      const hits = filters.length
        ? docs.filter((doc) =>
            filters.some(
              ([key, value]) =>
                String(
                  doc[key.includes('[name]') ? 'name' : key.includes('[id]') ? 'id' : 'slug'],
                ) === value,
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
    const walk = (value, key) => {
      if (typeof value === 'string') return prose.has(key) ? value : ''
      if (Array.isArray(value)) return value.map((entry) => walk(entry, key)).join(' ')
      if (!value || typeof value !== 'object') return ''
      return Object.entries(value)
        .map(([key, entry]) => (key === 'url' ? `<a href="${entry}">Link</a>` : walk(entry, key)))
        .join(' ')
    }
    const html = state.badPage
      ? '<p>Missing revised copy</p>'
      : `<p>${walk(Object.values(state.collections))}</p>`
    save()
    process.stdout.write(`${html}\n${status}`)
  }
} else process.exit(2)
