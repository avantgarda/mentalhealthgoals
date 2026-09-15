/**
 * Building a content plan, and reading one back.
 *
 * A plan script — private, in `temp/<name>/` — describes edits against a
 * snapshot of the target environment. These helpers cover what every such
 * script needs: reading the snapshot, editing Lexical rich text without
 * disturbing what it does not touch, minting IDs for new rows, writing the plan
 * with a review document a non-technical reader can sign off, and deriving
 * from that same plan what a rendered page must show once it is applied.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'

import {
  EDITABLE_COLLECTIONS,
  matchFieldFor,
  validatePlan,
  type ContentChange,
  type ContentPlan,
} from './content-patch-core'

type Collection = ContentChange['collection']
type Doc = Record<string, unknown> & { id: number | string; slug?: string; name?: string }
export type Sources = Partial<Record<Collection, Doc[]>>

// --- Snapshot ---------------------------------------------------------------

/** Every `sources/<collection>.json` that `content-snapshot` wrote. */
export function loadSources(dir: string): Sources {
  const sources: Sources = {}
  for (const collection of EDITABLE_COLLECTIONS) {
    const file = join(dir, 'sources', `${collection}.json`)
    if (existsSync(file)) sources[collection] = JSON.parse(readFileSync(file, 'utf8'))
  }
  if (!Object.keys(sources).length) throw new Error(`No sources under ${dir}/sources`)
  return sources
}

/** One record by the field the tool matches on. Throws rather than guess. */
export function find(sources: Sources, collection: Collection, value: string): Doc {
  const field = matchFieldFor(collection)
  const hits = (sources[collection] ?? []).filter((d) => d[field] === value)
  if (hits.length !== 1) {
    throw new Error(
      `Expected exactly one ${collection} with ${field} "${value}", found ${hits.length}`,
    )
  }
  return hits[0]
}

// --- Lexical ----------------------------------------------------------------

type Obj = Record<string, unknown>

/** Plain text of a node and its descendants. */
export const text = (node: unknown): string => {
  const n = node as Obj | undefined
  if (typeof n?.text === 'string') return n.text
  return ((n?.children as unknown[]) ?? []).map(text).join('')
}

/** Text with links kept visible as `[label](url)` — a re-pointed link is a
 * content change even when the words stay the same. */
export const inline = (node: unknown): string => {
  const n = node as Obj | undefined
  if (n?.type === 'link') {
    const url = (n.fields as Obj | undefined)?.url ?? ''
    return `[${((n.children as unknown[]) ?? []).map(inline).join('')}](${url})`
  }
  if (typeof n?.text === 'string') return n.text
  return ((n?.children as unknown[]) ?? []).map(inline).join('')
}

export const textNode = (value: string) => ({
  mode: 'normal',
  text: value,
  type: 'text',
  style: '',
  detail: 0,
  format: 0,
  version: 1,
})

export const paragraph = (value: string) => ({
  type: 'paragraph',
  format: '',
  indent: 0,
  version: 1,
  children: [textNode(value)],
  direction: 'ltr',
  textFormat: 0,
})

/** Retarget every custom link whose URL is exactly `from`. Returns the count. */
export function relink(node: unknown, from: string, to: string): number {
  let count = 0
  const walk = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(walk)
    if (!value || typeof value !== 'object') return
    const n = value as Obj
    const fields = n.fields as Obj | undefined
    if (n.type === 'link' && fields?.url === from) {
      fields.url = to
      count++
    }
    Object.values(n).forEach(walk)
  }
  walk(node)
  return count
}

/** Every link URL under a node, in document order. */
export function links(node: unknown): string[] {
  const out: string[] = []
  const walk = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(walk)
    if (!value || typeof value !== 'object') return
    const n = value as Obj
    const url = (n.fields as Obj | undefined)?.url
    if (n.type === 'link' && typeof url === 'string') out.push(url)
    Object.values(n).forEach(walk)
  }
  walk(node)
  return out
}

/** One reviewable segment per block, counting list items separately so a change
 * to a single bullet does not present as a rewrite of the whole list. */
export const segments = (node: unknown): string[] => {
  const n = node as Obj | undefined
  if (n?.type === 'list') {
    return ((n.children as unknown[]) ?? [])
      .map((li) => `• ${inline(li)}`)
      .filter((s) => s !== '• ')
  }
  const t = inline(n).trim()
  return t ? [t] : []
}

/**
 * Which keys hold words a reader sees. Everything else in a record — slugs,
 * enum values, IDs, block types, link kinds — is structure, and must never be
 * mistaken for a passage a page has to show.
 */
const PROSE_KEYS = new Set([
  'bio',
  'boundaryStatement',
  'caption',
  'content',
  'description',
  'heading',
  'item',
  'label',
  'point',
  'richText',
  'role',
  'strapline',
  'subheading',
  'summary',
  'text',
  'title',
])

const isRow = (n: Obj) => typeof n.label === 'string' && typeof n.url === 'string'

/** Segments of a field for the review: strings under prose keys, bullet rows,
 * `label: url` link rows, rich text, and whatever those nest inside. */
export function fieldSegments(value: unknown, key?: string): string[] {
  if (value == null) return []
  if (typeof value === 'string') return (!key || PROSE_KEYS.has(key)) && value.trim() ? [value] : []
  if (typeof value !== 'object') return []
  if (Array.isArray(value)) return value.flatMap((item) => fieldSegments(item, key))
  const n = value as Obj
  if (typeof n.point === 'string') return [n.point]
  if (isRow(n)) return [`${n.label}: ${n.url}`]
  if (n.root) return ((n.root as Obj).children as unknown[]).flatMap(segments)
  return Object.entries(n).flatMap(([k, v]) => fieldSegments(v, k))
}

// --- Building a plan --------------------------------------------------------

/** Mints IDs for rows that do not exist yet, and remembers them: Payload assigns
 * its own ID on insert, so the plan has to declare them as `generatedIds` or
 * the read-back can never match. */
export class Minter {
  readonly ids: string[] = []
  mint(): string {
    const id = randomBytes(12).toString('hex')
    this.ids.push(id)
    return id
  }
}

/** A change to one record: `after` names the fields being rewritten, `before`
 * is taken from the snapshot for exactly those fields. */
export function change(
  collection: Collection,
  doc: Doc,
  after: Record<string, unknown>,
  minter?: Minter,
): ContentChange {
  const field = matchFieldFor(collection)
  const before = Object.fromEntries(Object.keys(after).map((k) => [k, doc[k]]))
  const result: ContentChange = {
    collection,
    match: { field, value: String(doc[field]) },
    before,
    after,
  }
  if (minter?.ids.length) result.generatedIds = [...minter.ids]
  return result
}

export function writePlan(
  dir: string,
  name: string,
  changes: ContentChange[],
  status?: string,
): ContentPlan {
  const plan = validatePlan({ version: 1 as const, name, changes })
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan, null, 2), { mode: 0o600 })
  writeFileSync(join(dir, 'review.md'), renderReview(plan, status), { mode: 0o600 })
  return plan
}

// --- Review document --------------------------------------------------------

type Op = ['-' | '+', string]

/** Longest-common-subsequence diff, so an insertion reads as an insertion
 * rather than as every paragraph after it having been replaced. */
export function diff(a: string[], b: string[]): Op[] {
  const m = a.length
  const n = b.length
  const L: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      i++
      j++
    } else if (L[i + 1][j] >= L[i][j + 1]) ops.push(['-', a[i++]])
    else ops.push(['+', b[j++]])
  }
  while (i < m) ops.push(['-', a[i++]])
  while (j < n) ops.push(['+', b[j++]])
  return ops
}

export function render(ops: Op[]): string {
  const out: string[] = []
  for (let k = 0; k < ops.length; k++) {
    const [op, value] = ops[k]
    // A removal immediately followed by an addition is one rewritten passage.
    if (op === '-' && ops[k + 1]?.[0] === '+') {
      out.push(`Changed:\n\n> ${value}\n\nto:\n\n> ${ops[k + 1][1]}`)
      k++
    } else out.push(`${op === '-' ? 'Removed' : 'Added'}:\n\n> ${value}`)
  }
  return out.length ? out.join('\n\n') : 'No change.'
}

const renamedSlug = (c: ContentChange) =>
  typeof c.before.slug === 'string' && c.before.slug !== c.after.slug

export function renderReview(plan: ContentPlan, status?: string): string {
  let out = `# ${plan.name}\n\nGenerated from a snapshot of the target environment.\n\n`
  out += `**Status: ${status ?? 'not yet applied or verified.'}**\n\n`
  out +=
    '## What this plan cannot change\n\n' +
    'Records are only ever updated — nothing is created or deleted. Publishing status, ' +
    'media, relationships, people’s names, page URLs and the navigation globals are outside ' +
    'what the tool can write.\n\n'
  for (const c of plan.changes.filter(renamedSlug)) {
    const [base] = recordPaths(c.collection, '')
    out +=
      `## URL change\n\n\`${base}${c.before.slug}\` becomes \`${base}${c.after.slug}\`. ` +
      'Nothing redirects the old path; check for anything still linking to it.\n\n'
  }
  for (const c of plan.changes) {
    out += `## ${c.collection}/${c.match.value}\n\n`
    for (const key of Object.keys(c.after)) {
      const ops = diff(fieldSegments(c.before[key], key), fieldSegments(c.after[key], key))
      if (!ops.length) continue
      out += Object.keys(c.after).length > 1 ? `### ${key}\n\n` : ''
      out += `${render(ops)}\n\n`
    }
  }
  return out
}

// --- Verification derived from the plan --------------------------------------

export type Expectation = {
  label: string
  /** Where the record renders; a passage may be found on any of them, the
   * status is checked on the first. */
  paths: string[]
  expectStatus: number
  /** Text that must appear (whitespace-normalised, tags stripped). */
  expectText: string[]
  /** Text that must be gone. Only long passages: short ones recur elsewhere. */
  rejectText: string[]
  expectHref: string[]
  rejectHref: string[]
  /** A page's SEO title and description render in the document head, not its
   * body: checked against `<title>` and `<meta name="description">`. */
  expectHead: HeadPassage[]
  rejectHead: HeadPassage[]
}

export type HeadPassage = { head: 'title' | 'description'; text: string }

/** Where a record renders. A workstream's summary and description are shown on
 * the index, its other fields on its own page; people share one page. */
export function recordPaths(collection: Collection, key: string): string[] {
  switch (collection) {
    case 'pages':
      return [key === 'home' ? '/' : `/${key}`]
    case 'posts':
      return [`/posts/${key}`]
    case 'workstreams':
      return [`/workstreams/${key}`, '/workstreams']
    case 'people':
      return ['/people']
  }
}

type Passage = { text: string } | { href: string }

const normalise = (s: string) => s.replace(/\s+/g, ' ').trim()
/** A review segment as a reader sees it: no bullet, links as their label. */
const bare = (s: string) => normalise(s.replace(/^• /, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'))

/** What a page has to show for a field value: visible words, and link targets. */
function passages(value: unknown, key?: string, out: Passage[] = []): Passage[] {
  if (value == null) return out
  if (typeof value === 'string') {
    if ((!key || PROSE_KEYS.has(key)) && value.trim()) out.push({ text: normalise(value) })
    return out
  }
  if (typeof value !== 'object') return out
  if (Array.isArray(value)) {
    for (const item of value) passages(item, key, out)
    return out
  }
  const n = value as Obj
  if (typeof n.point === 'string') {
    out.push({ text: normalise(n.point) })
    return out
  }
  if (isRow(n)) {
    out.push({ text: normalise(n.label as string) }, { href: n.url as string })
    return out
  }
  if (n.root) {
    for (const block of (n.root as Obj).children as unknown[])
      for (const s of segments(block)) out.push({ text: bare(s) })
    for (const href of links(n)) out.push({ href })
    return out
  }
  for (const [k, v] of Object.entries(n)) passages(v, k, out)
  return out
}

/**
 * A page's `meta` group never reaches the body. `generateMeta` puts the title
 * in `<title>` (with the site name after it) and the description in
 * `<meta name="description">`, and `visibleText` strips both along with every
 * other tag — so a description that was correct read as missing until the
 * verifier looked in the head instead.
 */
export function headPassages(meta: unknown): HeadPassage[] {
  const m = meta as Obj | undefined
  const out: HeadPassage[] = []
  if (typeof m?.title === 'string' && m.title.trim()) {
    out.push({ head: 'title', text: normalise(m.title) })
  }
  if (typeof m?.description === 'string' && m.description.trim()) {
    out.push({ head: 'description', text: normalise(m.description) })
  }
  return out
}

export function deriveExpectations(plan: ContentPlan): Expectation[] {
  const out: Expectation[] = []
  const texts = (p: Passage[]) => p.flatMap((x) => ('text' in x ? [x.text] : []))
  const hrefs = (p: Passage[]) => p.flatMap((x) => ('href' in x ? [x.href] : []))
  for (const c of plan.changes) {
    const field = c.match.field
    const before = typeof c.before[field] === 'string' ? (c.before[field] as string) : c.match.value
    const after = typeof c.after[field] === 'string' ? (c.after[field] as string) : before
    const keys = Object.keys(c.after)
    const body = keys.filter((k) => k !== 'meta')
    const was = body.flatMap((k) => passages(c.before[k], k))
    const now = body.flatMap((k) => passages(c.after[k], k))
    const wasHead = keys.includes('meta') ? headPassages(c.before.meta) : []
    const nowHead = keys.includes('meta') ? headPassages(c.after.meta) : []
    const has = (list: HeadPassage[], h: HeadPassage) =>
      list.some((x) => x.head === h.head && x.text === h.text)
    const wasText = new Set(texts(was))
    const nowText = new Set(texts(now))
    const wasHref = new Set(hrefs(was))
    const nowHref = new Set(hrefs(now))
    if (before !== after) {
      out.push({
        label: `${c.collection}/${before} (old URL)`,
        paths: [recordPaths(c.collection, before)[0]],
        expectStatus: 404,
        expectText: [],
        rejectText: [],
        expectHref: [],
        rejectHref: [],
        expectHead: [],
        rejectHead: [],
      })
    }
    out.push({
      label: `${c.collection}/${after}`,
      paths: recordPaths(c.collection, after),
      expectStatus: 200,
      expectText: [...nowText].filter((s) => !wasText.has(s)),
      rejectText: [...wasText].filter((s) => !nowText.has(s) && s.length >= 40),
      expectHref: [...nowHref].filter((u) => !wasHref.has(u)),
      rejectHref: [...wasHref].filter((u) => !nowHref.has(u)),
      expectHead: nowHead.filter((h) => !has(wasHead, h)),
      rejectHead: wasHead.filter((h) => !has(nowHead, h)),
    })
  }
  return out
}

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')

/** What a reader sees: tags gone, entities decoded, whitespace collapsed. */
export function visibleText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(stripped).replace(/\s+/g, ' ')
}

/** What a crawler or a link preview reads: the document title and the
 * description meta tag, decoded and whitespace-collapsed. Attribute order is
 * not assumed — Next writes `name` before `content`; hand-written markup often
 * does not. */
export function headText(html: string): { title: string; description: string } {
  const head = html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? html
  const title = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''
  let description = ''
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const attribute = (name: string) =>
      tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'))?.[1]
    if (attribute('name')?.toLowerCase() === 'description') {
      description = attribute('content') ?? ''
      break
    }
  }
  return {
    title: normalise(decodeEntities(title)),
    description: normalise(decodeEntities(description)),
  }
}
