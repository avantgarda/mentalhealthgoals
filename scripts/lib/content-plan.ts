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
import { readFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { join } from 'node:path'

import { fileLabel, formatFileSize } from '../../src/utilities/fileLabel'
import {
  EDITABLE_COLLECTIONS,
  MAX_UPLOAD_BYTES,
  matchFieldFor,
  validatePlan,
  type ContentChange,
  type ContentPlan,
  type MediaUpload,
  type PartnerCreation,
} from './content-patch-core'

type Collection = ContentChange['collection']
type Doc = Record<string, unknown> & { id: number | string; slug?: string; name?: string }
/** An uploaded file, as the Media API returns it. The tool links to files and
 * uploads new ones a plan declares; it never edits or deletes one. */
export type MediaFile = {
  id: number | string
  filename?: string | null
  mimeType?: string | null
  filesize?: number | null
  url?: string | null
  alt?: string | null
}
export type Sources = Partial<Record<Collection, Doc[]>> & { media?: MediaFile[] }

// --- Snapshot ---------------------------------------------------------------

function readSources(dir: string): Sources {
  const sources: Sources = {}
  for (const collection of [...EDITABLE_COLLECTIONS, 'media' as const]) {
    const file = join(dir, 'sources', `${collection}.json`)
    if (existsSync(file)) sources[collection] = JSON.parse(readFileSync(file, 'utf8'))
  }
  return sources
}

/** Every `sources/<collection>.json` that `content-snapshot` wrote, Media
 * included: an internal link names a file or page only by its ID. */
export function loadSources(dir: string): Sources {
  const sources = readSources(dir)
  if (!Object.keys(sources).length) throw new Error(`No sources under ${dir}/sources`)
  return sources
}

// --- Files to upload ---------------------------------------------------------

/** What a plan script declares; `declareUpload` adds the reviewed size and hash. */
export type MediaUploadInput = Omit<MediaUpload, 'filesize' | 'sha256' | 'id' | 'mimeType'> & {
  mimeType?: 'application/pdf'
}

export const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

/**
 * The bytes of a file a plan uploads, read from the plan's directory. Refused
 * unless it is a PDF the CMS will accept — and, once declared, exactly the
 * file that was reviewed: one swapped or re-exported since would otherwise
 * upload unseen.
 */
export function readUploadFile(
  dir: string,
  upload: Pick<MediaUpload, 'file' | 'filename'> &
    Partial<Pick<MediaUpload, 'filesize' | 'sha256'>>,
): Buffer {
  const path = join(dir, upload.file)
  if (!existsSync(path) || !statSync(path).isFile())
    throw new Error(`File to upload not found: ${upload.file} (for ${upload.filename})`)
  const bytes = readFileSync(path)
  if (bytes.length > MAX_UPLOAD_BYTES)
    throw new Error(
      `${upload.file} is ${formatFileSize(bytes.length)}; the CMS accepts uploads up to ` +
        `${formatFileSize(MAX_UPLOAD_BYTES)}. Compress it or link to it elsewhere.`,
    )
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-')
    throw new Error(`${upload.file} is not a PDF`)
  if (
    (upload.filesize !== undefined && bytes.length !== upload.filesize) ||
    (upload.sha256 !== undefined && sha256(bytes) !== upload.sha256)
  )
    throw new Error(
      `${upload.file} has changed since the plan was reviewed: rebuild the plan and review it again`,
    )
  return bytes
}

/** Declare a file to upload, recording the size and hash of what is reviewed. */
export function declareUpload(dir: string, input: MediaUploadInput): MediaUpload {
  const bytes = readUploadFile(dir, input)
  return {
    ...input,
    mimeType: input.mimeType ?? 'application/pdf',
    filesize: bytes.length,
    sha256: sha256(bytes),
  }
}

/** Each upload as Media will list it, under its placeholder until a run gives
 * it an ID: what lets a review and `relinkToMedia` name the file. */
const plannedMedia = (uploads: MediaUpload[] = []): MediaFile[] =>
  uploads.map((upload) => ({
    id: upload.id ?? upload.reference,
    filename: upload.filename,
    mimeType: upload.mimeType,
    filesize: upload.filesize,
    url: `/api/media/file/${upload.filename}`,
  }))

/**
 * The snapshot as it will be once the plan's files are uploaded: each appears
 * in Media under its placeholder, so `relinkToMedia` links typed addresses to
 * it and the review names it. A file already in Media under the same name is
 * refused — link to that one, or choose another name.
 */
export function withUploads(sources: Sources, uploads: MediaUpload[]): Sources {
  for (const upload of uploads) {
    const existing = sources.media?.find((file) => file.filename === upload.filename)
    if (existing)
      throw new Error(
        `"${upload.filename}" is already in Media (#${existing.id}): link to it, or upload under another name`,
      )
  }
  return { ...sources, media: [...(sources.media ?? []), ...plannedMedia(uploads)] }
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

const isInternal = (fields: unknown) => (fields as Obj | undefined)?.linkType === 'internal'

/** What an internal link picked: `{ relationTo, value }`, where `value` is the
 * ID at depth 0 and the document itself when populated. */
function picked(fields: unknown): { relationTo: string; id: unknown } | undefined {
  const doc = (fields as Obj | undefined)?.doc as Obj | undefined
  if (!isInternal(fields) || typeof doc?.relationTo !== 'string') return undefined
  const value = doc.value as Obj | number | string | undefined
  return {
    relationTo: doc.relationTo,
    id: value && typeof value === 'object' ? value.id : value,
  }
}

const byId = <T extends { id: unknown }>(list: T[] | undefined, id: unknown) =>
  list?.find((item) => String(item.id) === String(id))

/** The file in Media an internal link points at, if the sources have it. */
function linkedFile(fields: unknown, sources: Sources): MediaFile | undefined {
  const doc = picked(fields)
  return doc?.relationTo === 'media' ? byId(sources.media, doc.id) : undefined
}

const LINK_KINDS: Record<string, string> = { pages: 'page', posts: 'post', media: 'media' }

/**
 * Where a link goes, for a reviewer: a custom link's URL, or what an internal
 * link picked — `page:/about`, `post:/posts/launch`, `media:slides.pdf`. A
 * document the sources do not have shows as its ID, `media#42`, so a link
 * re-pointed at another document still reads as a change.
 */
export function linkTarget(fields: unknown, sources: Sources = {}): string {
  if (!isInternal(fields)) {
    const url = (fields as Obj | undefined)?.url
    return typeof url === 'string' ? url : ''
  }
  const doc = picked(fields)
  if (!doc) return 'internal:?'
  const kind = LINK_KINDS[doc.relationTo] ?? doc.relationTo
  if (doc.relationTo === 'media') {
    const filename = byId(sources.media, doc.id)?.filename
    if (filename) return `${kind}:${filename}`
  } else if (doc.relationTo === 'pages' || doc.relationTo === 'posts') {
    const slug = byId(sources[doc.relationTo], doc.id)?.slug
    if (slug) return `${kind}:${recordPaths(doc.relationTo, slug)[0]}`
  }
  return `${kind}#${String(doc.id)}`
}

/** Text with links kept visible as `[label](target)` — a re-pointed link is a
 * content change even when the words stay the same. Pass the sources to name
 * an internal link's page or file rather than its ID. */
export const inline = (node: unknown, sources: Sources = {}): string => {
  const n = node as Obj | undefined
  const children = () => ((n?.children as unknown[]) ?? []).map((c) => inline(c, sources)).join('')
  if (n?.type === 'link') return `[${children()}](${linkTarget(n.fields, sources)})`
  if (typeof n?.text === 'string') return n.text
  return children()
}

/**
 * The words a reader sees, as the site renders them (`RichText/links.tsx`): a
 * link is its text, except that a link to a file in Media is followed by the
 * file's type and size — "Slides (PDF, 2.3 MB)". A file the sources do not
 * have renders as plain words, as the site does when the file is gone.
 */
export const readerText = (node: unknown, sources: Sources = {}): string => {
  const n = node as Obj | undefined
  if (typeof n?.text === 'string') return n.text
  const words = ((n?.children as unknown[]) ?? []).map((c) => readerText(c, sources)).join('')
  const file = n?.type === 'link' ? linkedFile(n.fields, sources) : undefined
  const label = file?.url ? fileLabel(file) : ''
  return label ? `${words} (${label})` : words
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
    if (n.type === 'link' && !isInternal(fields) && fields?.url === from) {
      fields.url = to
      count++
    }
    Object.values(n).forEach(walk)
  }
  walk(node)
  return count
}

/** Where a typed link to an uploaded file points: `/api/media/file/<filename>`. */
const FILE_URL = /^\/api\/media\/file\/([^/?#]+)$/
/** A type and size typed beside a file link: "(PDF, 2.3 MB)". */
const LABEL = String.raw`\(\s*[a-z0-9]{2,5},\s*\d+(?:\.\d+)?\s*[kmg]b\s*\)`
const LABEL_AT_END = new RegExp(String.raw`\s*${LABEL}\s*$`, 'i')
const LABEL_AT_START = new RegExp(String.raw`^\s*${LABEL}`, 'i')

/**
 * Turn every custom link to an uploaded file — `/api/media/file/<filename>` —
 * into a link to that file in Media, as the link dialog's picker makes it. The
 * site then links to the file and adds its type and size itself, so a size
 * typed at the end of the link's words ("Slides (PDF, 2.3 MB)") is dropped or
 * it would show twice. Refuses a file `sources.media` does not have, or one
 * that is not a PDF: the picker offers PDFs only. Returns the filenames
 * converted, in document order, for the plan to check against what it expects.
 */
export function relinkToMedia(node: unknown, sources: Sources): string[] {
  const converted: string[] = []
  const walk = (value: unknown, siblings?: unknown[], index = 0) => {
    if (Array.isArray(value)) return value.forEach((item, i) => walk(item, value, i))
    if (!value || typeof value !== 'object') return
    const n = value as Obj
    const fields = n.fields as Obj | undefined
    const path = typeof fields?.url === 'string' ? FILE_URL.exec(fields.url) : null
    if (n.type !== 'link' || isInternal(fields) || !path) {
      Object.values(n).forEach((child) => walk(child))
      return
    }
    const filename = decodeURIComponent(path[1])
    if (!sources.media) throw new Error('No sources/media.json: re-take the snapshot')
    const file = sources.media.find((f) => f.filename === filename)
    if (!file)
      throw new Error(
        `No file named "${filename}" in Media: declare it as an upload and pass withUploads(sources, uploads)`,
      )
    if (file.mimeType !== 'application/pdf')
      throw new Error(
        `"${filename}" in Media is ${file.mimeType ?? 'of unknown type'}, not a PDF; ` +
          'the link picker offers PDFs only',
      )
    const next = siblings?.[index + 1] as Obj | undefined
    if (typeof next?.text === 'string' && LABEL_AT_START.test(next.text))
      throw new Error(`"${filename}": a size follows the link; take it out of that text first`)
    const words = (n.children as Obj[] | undefined) ?? []
    const last = words.at(-1)
    if (typeof last?.text === 'string') {
      last.text = last.text.replace(LABEL_AT_END, '')
      // The size in a text node of its own: drop the node, and the space before it.
      if (!last.text && words.length > 1) {
        words.pop()
        const previous = words.at(-1)
        if (typeof previous?.text === 'string') previous.text = previous.text.trimEnd()
      }
    }
    if (!text(n).trim()) throw new Error(`"${filename}": the link has no words besides its size`)
    const linkFields: Obj = { ...fields }
    delete linkFields.url
    n.fields = { ...linkFields, linkType: 'internal', doc: { relationTo: 'media', value: file.id } }
    converted.push(filename)
  }
  walk(node)
  return converted
}

/** Every link target a page renders under a node, in document order: a custom
 * link's URL, and a linked file's URL when the sources have the file. Links to
 * pages and posts are left out. */
export function links(node: unknown, sources: Sources = {}): string[] {
  const out: string[] = []
  const walk = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(walk)
    if (!value || typeof value !== 'object') return
    const n = value as Obj
    const fields = n.fields as Obj | undefined
    const url = isInternal(fields) ? linkedFile(fields, sources)?.url : fields?.url
    if (n.type === 'link' && typeof url === 'string') out.push(url)
    Object.values(n).forEach(walk)
  }
  walk(node)
  return out
}

/** Every Media ID linked from rich text under a value, once each. */
export function linkedMediaIds(value: unknown): (number | string)[] {
  const out = new Set<number | string>()
  const walk = (item: unknown) => {
    if (Array.isArray(item)) return item.forEach(walk)
    if (!item || typeof item !== 'object') return
    const n = item as Obj
    const doc = n.type === 'link' ? picked(n.fields) : undefined
    if (doc?.relationTo === 'media' && (typeof doc.id === 'number' || typeof doc.id === 'string'))
      out.add(doc.id)
    Object.values(n).forEach(walk)
  }
  walk(value)
  return [...out]
}

/** One reviewable segment per block, counting list items separately so a change
 * to a single bullet does not present as a rewrite of the whole list. */
export const segments = (node: unknown, sources: Sources = {}): string[] => {
  const n = node as Obj | undefined
  if (n?.type === 'list') {
    return ((n.children as unknown[]) ?? [])
      .map((li) => `• ${inline(li, sources)}`)
      .filter((s) => s !== '• ')
  }
  const t = inline(n, sources).trim()
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
  'name',
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
export function fieldSegments(value: unknown, key?: string, sources: Sources = {}): string[] {
  if (value == null) return []
  if (typeof value === 'string') return (!key || PROSE_KEYS.has(key)) && value.trim() ? [value] : []
  if (typeof value !== 'object') return []
  if (Array.isArray(value)) return value.flatMap((item) => fieldSegments(item, key, sources))
  const n = value as Obj
  if (typeof n.point === 'string') return [n.point]
  if (isRow(n)) return [`${n.label}: ${n.url}`]
  if (n.root)
    return ((n.root as Obj).children as unknown[]).flatMap((block) => segments(block, sources))
  return Object.entries(n).flatMap(([k, v]) => fieldSegments(v, k, sources))
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

/** What a plan creates besides its updates. A bare array is partners, as
 * plan scripts written before uploads existed pass it. */
export type Creations = { createPartners?: PartnerCreation[]; uploadMedia?: MediaUpload[] }

export function writePlan(
  dir: string,
  name: string,
  changes: ContentChange[],
  status?: string,
  creations?: PartnerCreation[] | Creations,
): ContentPlan {
  const { createPartners, uploadMedia } = Array.isArray(creations)
    ? { createPartners: creations, uploadMedia: undefined }
    : (creations ?? {})
  const plan = validatePlan({
    version: 1 as const,
    name,
    changes,
    ...(createPartners ? { createPartners } : {}),
    ...(uploadMedia?.length ? { uploadMedia } : {}),
  })
  // The file reviewed is the file the run will upload.
  for (const upload of plan.uploadMedia ?? []) readUploadFile(dir, upload)
  // The snapshot beside the plan names the pages and files internal links pick.
  const sources = readSources(dir)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan, null, 2), { mode: 0o600 })
  writeFileSync(join(dir, 'review.md'), renderReview(plan, status, sources), { mode: 0o600 })
  writeFileSync(join(dir, 'qa.md'), renderChecklist(plan), { mode: 0o600 })
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

/** The review a non-technical reader signs off. With the snapshot's sources,
 * an internal link shows the page or file it picks rather than an ID; a link
 * to a file the plan uploads shows that file's name. */
export function renderReview(plan: ContentPlan, status?: string, snapshot: Sources = {}): string {
  const sources = {
    ...snapshot,
    media: [...(snapshot.media ?? []), ...plannedMedia(plan.uploadMedia)],
  }
  let out = `# ${plan.name}\n\nGenerated from a snapshot of the target environment.\n\n`
  out += `**Status: ${status ?? 'not yet applied or verified.'}**\n\n`
  out +=
    '## What this plan cannot change\n\n' +
    'Only the listed content fields, partner relationships and existing-person corrections ' +
    'are updated. New programme partners are created, and files uploaded to Media, only when ' +
    'listed below. No records or files are deleted or replaced, and no Team members added. ' +
    'Publishing status, page URLs and navigation globals are outside what the tool can write.\n\n'
  for (const upload of plan.uploadMedia ?? []) {
    out += `## New file in Media: ${upload.filename}\n\n`
    out +=
      'Uploaded before any record changes, and served at ' +
      `\`/api/media/file/${upload.filename}\`. Links below show it as \`media:${upload.filename}\`.\n\n` +
      `- File: \`${upload.file}\`\n` +
      `- Size: ${formatFileSize(upload.filesize)} (${upload.filesize.toLocaleString('en-GB')} bytes)\n` +
      `- Alt text: ${upload.alt}\n` +
      `- SHA-256: \`${upload.sha256}\`\n` +
      `- Reference: \`${upload.reference}\`\n\n`
  }
  for (const partner of plan.createPartners ?? []) {
    out += `## New programme partner: ${partner.data.name}\n\n`
    out += `Reference: \`${partner.reference}\`\n\n`
    out += `\`\`\`json\n${JSON.stringify(partner.data, null, 2)}\n\`\`\`\n\n`
  }
  for (const c of plan.changes.filter(renamedSlug)) {
    const [base] = recordPaths(c.collection, '')
    out +=
      `## URL change\n\n\`${base}${c.before.slug}\` becomes \`${base}${c.after.slug}\`. ` +
      'Nothing redirects the old path; check for anything still linking to it.\n\n'
  }
  for (const c of plan.changes) {
    out += `## ${c.collection}/${c.match.value}\n\n`
    for (const key of Object.keys(c.after)) {
      if (key === 'slug' && renamedSlug(c)) continue // already shown as a URL change
      const ops = diff(
        fieldSegments(c.before[key], key, sources),
        fieldSegments(c.after[key], key, sources),
      )
      const relationships = (value: unknown, path: string, out: Record<string, unknown> = {}) => {
        if (Array.isArray(value))
          value.forEach((entry, i) => relationships(entry, `${path}.${i}`, out))
        else if (value && typeof value === 'object') {
          for (const [name, entry] of Object.entries(value)) {
            if (name === 'partners') out[`${path}.${name}`] = entry
            else relationships(entry, `${path}.${name}`, out)
          }
        }
        return out
      }
      const beforeRel =
        key === 'partners' ? { partners: c.before[key] } : relationships(c.before[key], key)
      const afterRel =
        key === 'partners' ? { partners: c.after[key] } : relationships(c.after[key], key)
      const relPaths = [...new Set([...Object.keys(beforeRel), ...Object.keys(afterRel)])].filter(
        (path) => !isDeepStrictEqual(beforeRel[path], afterRel[path]),
      )
      if (!ops.length && !relPaths.length && isDeepStrictEqual(c.before[key], c.after[key]))
        continue
      out += Object.keys(c.after).length > 1 ? `### ${key}\n\n` : ''
      if (ops.length) out += `${render(ops)}\n\n`
      for (const path of relPaths)
        out += `Partner relationship \`${path}\`:\n\nBefore: \`${JSON.stringify(beforeRel[path] ?? null)}\`\n\nAfter: \`${JSON.stringify(afterRel[path] ?? null)}\`\n\n`
      if (!ops.length && !relPaths.length)
        out += `Structural change:\n\nBefore:\n\n\`\`\`json\n${JSON.stringify(c.before[key], null, 2)}\n\`\`\`\n\nAfter:\n\n\`\`\`json\n${JSON.stringify(c.after[key], null, 2)}\n\`\`\`\n\n`
    }
  }
  return out
}

/** A durable handoff checklist; automated success never ticks visual review. */
export function renderChecklist(plan: ContentPlan): string {
  const paths = [
    ...new Set(
      plan.changes.flatMap((change) =>
        recordPaths(
          change.collection,
          String(change.after[change.match.field] ?? change.match.value),
        ),
      ),
    ),
  ]
  return (
    `# ${plan.name} — completion review\n\n` +
    'Record dated evidence here after the user runs the command. Consult scripts/CONTENT-PATCH.md for the full checklist.\n\n' +
    '- [ ] Approved scope and any manual CMS/asset steps are listed in RUN.md.\n' +
    '- [ ] Automated API, content and page checks passed; receipt directory recorded.\n' +
    paths.map((path) => `- [ ] Live \`${path}\` reviewed on desktop and mobile.\n`).join('') +
    '- [ ] Other pages displaying the affected person, workstream or partner reviewed.\n' +
    '- [ ] Relevant names, titles, roles, full biographies and image alt text checked together.\n' +
    '- [ ] Partner links, correct logo artwork, loading, spacing and optical size checked.\n' +
    (plan.uploadMedia ?? [])
      .map(
        (upload) =>
          `- [ ] \`/api/media/file/${upload.filename}\` opens the reviewed document; its alt text in Media is right.\n`,
      )
      .join('') +
    (linkedMediaIds(plan.changes.map((change) => change.after)).length
      ? '- [ ] Every file link opens the right PDF, and its type and size show once.\n'
      : '') +
    '- [ ] Manual steps completed, or outstanding items clearly reported.\n'
  )
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

/** A block's passages as a reader sees them, a list's items separately. */
const readerSegments = (node: unknown, sources: Sources): string[] => {
  const n = node as Obj | undefined
  const items = n?.type === 'list' ? ((n.children as unknown[]) ?? []) : [n]
  return items.map((item) => normalise(readerText(item, sources))).filter(Boolean)
}

/** What a page has to show for a field value: visible words, and link targets. */
function passages(
  value: unknown,
  key: string | undefined,
  sources: Sources,
  out: Passage[] = [],
): Passage[] {
  if (value == null) return out
  if (typeof value === 'string') {
    if ((!key || PROSE_KEYS.has(key)) && value.trim()) out.push({ text: normalise(value) })
    return out
  }
  if (typeof value !== 'object') return out
  if (Array.isArray(value)) {
    for (const item of value) passages(item, key, sources, out)
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
      for (const s of readerSegments(block, sources)) out.push({ text: s })
    for (const href of links(n, sources)) out.push({ href })
    return out
  }
  for (const [k, v] of Object.entries(n)) passages(v, k, sources, out)
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

/** What each changed record's page must and must not show once the plan is
 * applied. Links to files in Media need `sources.media` — the files as the
 * deployment has them — for the type and size the site adds after the words. */
export function deriveExpectations(plan: ContentPlan, sources: Sources = {}): Expectation[] {
  const out: Expectation[] = []
  const texts = (p: Passage[]) => p.flatMap((x) => ('text' in x ? [x.text] : []))
  const hrefs = (p: Passage[]) => p.flatMap((x) => ('href' in x ? [x.href] : []))
  for (const c of plan.changes) {
    const field = c.match.field
    const before = typeof c.before[field] === 'string' ? (c.before[field] as string) : c.match.value
    const after = typeof c.after[field] === 'string' ? (c.after[field] as string) : before
    const keys = Object.keys(c.after)
    const body = keys.filter((k) => k !== 'meta')
    const was = body.flatMap((k) => passages(c.before[k], k, sources))
    const now = body.flatMap((k) => passages(c.after[k], k, sources))
    const wasHead = keys.includes('meta') ? headPassages(c.before.meta) : []
    const nowHead = keys.includes('meta') ? headPassages(c.after.meta) : []
    const has = (list: HeadPassage[], h: HeadPassage) =>
      list.some((x) => x.head === h.head && x.text === h.text)
    const wasText = new Set(texts(was))
    const nowText = new Set(texts(now))
    const wasHref = new Set(hrefs(was))
    const nowHref = new Set(hrefs(now))
    if (c.match.field === 'slug' && before !== after) {
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
      // Rendered text is checked by substring. Wording retained inside an
      // extended passage cannot also be forbidden (for example, a closing
      // agenda item with its time range appended). Exact API read-back still
      // checks the complete fields and row contents.
      rejectText: [...wasText].filter(
        (s) => s.length >= 40 && ![...nowText].some((current) => current.includes(s)),
      ),
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
