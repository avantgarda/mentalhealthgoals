import { isDeepStrictEqual } from 'node:util'

export type ContentChange = {
  collection: 'pages' | 'posts' | 'workstreams' | 'people'
  match: { field: 'slug' | 'name'; value: string }
  before: Record<string, unknown>
  after: Record<string, unknown>
  generatedIds?: string[]
}
export type PartnerCreation = {
  /** A placeholder used only in reviewed partner relationship arrays. */
  reference: string
  data: {
    name: string
    url: string
    role: 'partner'
    showInFooter: false
    usageNote: string
    strapline?: string
    order?: number
  }
}
/** A file the run uploads to Media before it changes any record. */
export type MediaUpload = {
  /** A placeholder used only as the file a reviewed rich-text link picks. */
  reference: string
  /** The local file, relative to the plan's directory. */
  file: string
  /** The name Media serves it under: `/api/media/file/<filename>`. */
  filename: string
  alt: string
  mimeType: 'application/pdf'
  /** The reviewed bytes: a file swapped after review is refused, and a file
   * already in Media under this name is reused only if it is these bytes. */
  filesize: number
  sha256: string
  /** The Media record, once a run has uploaded or found the file. Only a
   * resolved plan carries it. */
  id?: number
}
export type ContentPlan = {
  version: 1
  name: string
  changes: ContentChange[]
  createPartners?: PartnerCreation[]
  uploadMedia?: MediaUpload[]
}

/** Uploads go through a Vercel function, whose request limit is 4.5 MB. A
 * 4 MB file leaves room for the rest of the request. */
export const MAX_UPLOAD_BYTES = 4_000_000
const UPLOAD_KEYS = ['reference', 'file', 'filename', 'alt', 'mimeType', 'filesize', 'sha256', 'id']
const MEDIA_REFERENCE = /^__MEDIA_[A-Z0-9_]+__$/
/** Lowercase words joined by hyphens: Media serves it unchanged, and it reads
 * plainly in an address. */
export const UPLOAD_FILENAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.pdf$/

/** A placeholder for a file the plan uploads, before the run resolves it. */
export const isMediaReference = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('__MEDIA_')

/** A path that stays inside the plan's directory. */
const isPlanRelative = (path: string) =>
  path.split(/[\\/]/).every((part) => part && part !== '.' && part !== '..')

function validateUpload(upload: MediaUpload, filenames: Set<string>) {
  const name = typeof upload?.filename === 'string' ? upload.filename : '?'
  if (
    !upload ||
    typeof upload !== 'object' ||
    Object.keys(upload).some((key) => !UPLOAD_KEYS.includes(key)) ||
    !MEDIA_REFERENCE.test(upload.reference ?? '')
  )
    throw new Error(`Invalid media upload: ${name}`)
  if (typeof upload.file !== 'string' || !isPlanRelative(upload.file))
    throw new Error(`Upload file must be a path inside the plan's directory: ${name}`)
  if (!UPLOAD_FILENAME.test(name))
    throw new Error(
      `Upload filename must be lowercase words joined by hyphens, ending .pdf: ${name}`,
    )
  if (filenames.has(name)) throw new Error(`Duplicate media upload: ${name}`)
  if (upload.mimeType !== 'application/pdf') throw new Error(`Only PDFs are uploaded: ${name}`)
  if (typeof upload.alt !== 'string' || !upload.alt.trim())
    throw new Error(`Upload needs alt text: ${name}`)
  if (
    !Number.isSafeInteger(upload.filesize) ||
    upload.filesize <= 0 ||
    typeof upload.sha256 !== 'string' ||
    !/^[0-9a-f]{64}$/.test(upload.sha256)
  )
    throw new Error(`Upload needs the reviewed file's size and SHA-256: ${name}`)
  if (upload.filesize > MAX_UPLOAD_BYTES)
    throw new Error(
      `Upload is larger than the CMS accepts (${MAX_UPLOAD_BYTES / 1e6} MB): ${name}, ${upload.filesize} bytes`,
    )
  if (upload.id !== undefined && !(Number.isSafeInteger(upload.id) && upload.id > 0))
    throw new Error(`Invalid Media ID for upload: ${name}`)
  filenames.add(name)
}

/** Pages keep their URLs out of reach: they carry the site's navigation and the
 * bulk of inbound links. A workstream's `slug` is editable because its title and
 * its URL are expected to move together, and only ever before launch.
 */
const allowedFields: Record<ContentChange['collection'], string[]> = {
  pages: ['layout', 'hero', 'meta'],
  // Body only. A post is dated news, so its title and URL stay put; the case for
  // editing one at all is a link or a fact that has since gone wrong.
  posts: ['content'],
  workstreams: [
    'slug',
    'title',
    'summary',
    'description',
    'boundaryStatement',
    'primaryFocus',
    'keyQuestions',
    'differentiators',
    'resources',
    'partners',
  ],
  people: ['name', 'role', 'bio'],
}

export const EDITABLE_COLLECTIONS = Object.keys(allowedFields) as ContentChange['collection'][]

/** People are matched by name; everything else has a slug. */
export function matchFieldFor(collection: ContentChange['collection']): 'name' | 'slug' {
  return collection === 'people' ? 'name' : 'slug'
}

/** An address under the reserved `.invalid` TLD: it can never receive mail and
 * is never a real account, which is what makes it usable as a canary. */
export function isCanaryAddress(email: string): boolean {
  return /@[^@\s]+\.invalid$/i.test(email.trim())
}

/**
 * Which account a run may use. A preview deployment is only known to be reading
 * its own database branch if it can authenticate an account that exists there
 * and nowhere else — the temporary editor `content-preview-editor` creates. A
 * login with a real account proves nothing: it succeeds equally against
 * production, which is exactly the failure this exists to catch. On production
 * the reverse holds — a canary address has no business existing there.
 */
export function checkCanary(environment: 'preview' | 'production', email: string): void {
  const canary = isCanaryAddress(email)
  if (environment === 'preview' && !canary) {
    throw new Error(
      'Preview runs must log in as the temporary editor on the preview database branch ' +
        '(an @….invalid address from `pnpm content:editor create`). That login succeeding ' +
        'is the proof the deployment is reading its own branch and not production.',
    )
  }
  if (environment === 'production' && canary) {
    throw new Error(
      'A temporary-editor address on a production deployment means a canary account ' +
        'exists where it never should. Investigate before writing anything.',
    )
  }
}

export function validatePlan(value: unknown): ContentPlan {
  const plan = value as ContentPlan
  if (plan?.version !== 1 || !plan.name || !Array.isArray(plan.changes) || !plan.changes.length) {
    throw new Error('Invalid content plan')
  }
  const seen = new Set<string>()
  if (
    Object.keys(plan).some(
      (key) => !['version', 'name', 'changes', 'createPartners', 'uploadMedia'].includes(key),
    )
  )
    throw new Error('Unsupported content plan option')
  const references = new Set<string>()
  const partnerNames = new Set<string>()
  if (plan.createPartners !== undefined && !Array.isArray(plan.createPartners))
    throw new Error('Invalid partner creations')
  for (const partner of plan.createPartners ?? []) {
    const data = partner?.data
    if (
      !/^__PARTNER_[A-Z0-9_]+__$/.test(partner?.reference ?? '') ||
      references.has(partner.reference) ||
      Object.keys(partner).some((key) => !['reference', 'data'].includes(key)) ||
      !data ||
      typeof data.name !== 'string' ||
      !data.name.trim() ||
      typeof data.url !== 'string' ||
      typeof data.usageNote !== 'string' ||
      !data.usageNote.trim() ||
      data.role !== 'partner' ||
      data.showInFooter !== false ||
      Object.keys(data).some(
        (key) =>
          !['name', 'url', 'role', 'showInFooter', 'usageNote', 'strapline', 'order'].includes(key),
      ) ||
      (data.strapline !== undefined && typeof data.strapline !== 'string') ||
      (data.order !== undefined && !Number.isFinite(data.order)) ||
      partnerNames.has(data.name)
    )
      throw new Error('Invalid or duplicate programme partner creation')
    const url = new URL(data.url)
    if (url.protocol !== 'https:' || url.username || url.password)
      throw new Error('Partner URL must be an HTTPS website without credentials')
    references.add(partner.reference)
    partnerNames.add(data.name)
  }
  if (plan.uploadMedia !== undefined && !Array.isArray(plan.uploadMedia))
    throw new Error('Invalid media uploads')
  const uploads = new Map<string, MediaUpload>()
  const filenames = new Set<string>()
  for (const upload of plan.uploadMedia ?? []) {
    validateUpload(upload, filenames)
    if (uploads.has(upload.reference))
      throw new Error(`Duplicate media upload reference: ${upload.reference}`)
    uploads.set(upload.reference, upload)
  }
  const usedReferences = new Set<string>()
  for (const change of plan.changes) {
    const fields = allowedFields[change.collection]
    if (
      !fields ||
      !change.match?.value ||
      change.match.field !== matchFieldFor(change.collection) ||
      !change.before ||
      !change.after
    )
      throw new Error('Invalid content change')
    const keys = Object.keys(change.after)
    if (
      !keys.length ||
      !isDeepStrictEqual(keys.sort(), Object.keys(change.before).sort()) ||
      keys.some((key) => !fields.includes(key))
    )
      throw new Error('Unapproved content field')
    // New partner placeholders must be whole array entries in an actual
    // partner relationship, never a word in copy or a different relationship.
    // A new file's placeholder is only ever the file an internal link picks:
    // `fields.doc.value` under `linkType: 'internal'`, `relationTo: 'media'`.
    const inspect = (
      item: unknown,
      side: 'before' | 'after',
      slot?: 'partners' | 'media',
      parent?: Record<string, unknown>,
    ) => {
      if (typeof item === 'string' && item.startsWith('__PARTNER_')) {
        if (side !== 'after' || slot !== 'partners' || !references.has(item))
          throw new Error('Partner reference must be declared and used only in after.partners')
        usedReferences.add(item)
      } else if (isMediaReference(item)) {
        if (side !== 'after' || slot !== 'media' || !uploads.has(item))
          throw new Error(
            'Media reference must be declared and used only as the file a link picks, in after',
          )
        usedReferences.add(item)
      } else if (Array.isArray(item)) {
        item.forEach((entry) => inspect(entry, side, slot === 'partners' ? slot : undefined))
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>
        const linkedFile =
          obj.relationTo === 'media' && parent?.linkType === 'internal' && parent.doc === obj
        Object.entries(obj).forEach(([key, entry]) =>
          inspect(
            entry,
            side,
            key === 'partners' &&
              Array.isArray(entry) &&
              (obj.blockType === 'partnerLogos' ||
                (item === change[side] && change.collection === 'workstreams'))
              ? 'partners'
              : key === 'value' && linkedFile
                ? 'media'
                : undefined,
            obj,
          ),
        )
      }
    }
    inspect(change.before, 'before')
    inspect(change.after, 'after')
    if ('partners' in change.after) {
      for (const side of ['before', 'after'] as const) {
        const ids = change[side].partners
        if (
          !Array.isArray(ids) ||
          ids.some(
            (id) =>
              !(typeof id === 'number' && Number.isSafeInteger(id) && id > 0) &&
              !(side === 'after' && typeof id === 'string' && references.has(id)),
          ) ||
          new Set(ids).size !== ids.length
        )
          throw new Error('Invalid partner relationship IDs')
      }
    }
    const collectIds = (value: unknown): string[] => {
      if (!value || typeof value !== 'object') return []
      return Object.entries(value).flatMap(([key, item]) =>
        key === 'id' && typeof item === 'string' ? [item] : collectIds(item),
      )
    }
    const beforeIds = new Set(collectIds(change.before))
    const afterIds = new Set(collectIds(change.after))
    if (
      change.generatedIds !== undefined &&
      (!Array.isArray(change.generatedIds) ||
        change.generatedIds.some(
          (id) => typeof id !== 'string' || beforeIds.has(id) || !afterIds.has(id),
        ))
    )
      throw new Error('Generated IDs must identify new rows only')
    // A change may rewrite the very field it matches on. The match value has to be
    // the baseline, so the record is found before the change and named consistently.
    const field = change.match.field
    if (field in change.before && change.before[field] !== change.match.value)
      throw new Error(`Match value must be the baseline ${field}: ${change.match.value}`)
    if (field in change.after && (typeof change.after[field] !== 'string' || !change.after[field]))
      throw new Error(`A rewritten ${field} must be a non-empty string`)

    for (const value of matchValues(change)) {
      const identity = `${change.collection}/${value}`
      if (seen.has(identity)) throw new Error(`Duplicate content target: ${identity}`)
      seen.add(identity)
    }
  }
  if ([...references].some((reference) => !usedReferences.has(reference)))
    throw new Error('Every new partner must be referenced by a reviewed change')
  // A resolved plan carries each file's Media ID in place of its placeholder.
  for (const upload of uploads.values())
    if (upload.id === undefined && !usedReferences.has(upload.reference))
      throw new Error(
        `Every media upload must be linked from a reviewed change: ${upload.filename}`,
      )
  return plan
}

/** Resolve only placeholders in after; an absent partner or file stays
 * symbolic in a dry run. The baseline is never rewritten. A resolved upload
 * keeps its declaration, with the Media ID, for verification. */
export function resolveReferences(
  plan: ContentPlan,
  ids: Map<string, number | string>,
): ContentPlan {
  const out = structuredClone(plan)
  out.changes = out.changes.map((change) => ({
    ...change,
    after: JSON.parse(JSON.stringify(change.after), (_key, value) => ids.get(value) ?? value),
  }))
  if (out.uploadMedia)
    out.uploadMedia = out.uploadMedia.map((upload) => {
      const id = ids.get(upload.reference)
      return typeof id === 'number' ? { ...upload, id } : upload
    })
  return out
}

/** A collection that keeps drafts reports a `_status`; one that does not omits it
 * entirely. Reading that from the document rather than naming the collection means
 * a collection added to the allowlist later cannot quietly skip the check — and
 * because autosave writes drafts continuously, an unpublished latest draft is also
 * how an editor working in the admin right now is detected.
 */
export function isUnpublishedDraft(doc: Record<string, unknown>): boolean {
  return doc._status !== undefined && doc._status !== 'published'
}

/** The names a record may answer to: its baseline value, and the rewritten one
 * where the plan changes it. Looking under both keeps a re-run — and a reversal —
 * finding the same document after its slug has moved.
 */
export function matchValues(change: ContentChange): string[] {
  const field = change.match.field
  const candidates = [change.match.value, change.before[field], change.after[field]]
  return [...new Set(candidates.filter((v): v is string => typeof v === 'string' && v.length > 0))]
}

/** Two reads of one document agree, allowing only for the block IDs Payload mints
 * on every read. This is the mid-run edit detector: `updatedAt` is compared
 * separately, so anything a save would touch still trips it.
 */
export function sameDocument(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return matchesContent(a, b, new Set())
}

export function assessChange(doc: Record<string, unknown>, change: ContentChange) {
  const pick = Object.fromEntries(Object.keys(change.after).map((key) => [key, doc[key]]))
  const generatedIds = new Set(change.generatedIds ?? [])
  if (matchesContent(pick, change.after, generatedIds)) return 'already applied'
  if (!matchesContent(pick, change.before, generatedIds)) {
    throw new Error(
      `Content differs from reviewed baseline: ${change.collection}/${change.match.value}`,
    )
  }
  return 'ready'
}

/** Payload replaces supplied IDs on newly inserted rows. Ignore only those
 * explicitly identified new-row IDs, never existing row IDs or row contents.
 *
 * One further ID carries no information: a Lexical block node's `fields.id`.
 * Where a block was seeded without one, Payload mints a fresh ObjectID on every
 * read, so it differs between any two fetches — the snapshot, the pre-write
 * check and the read-back alike. That single key is skipped inside a block's
 * `fields`; every other value in the block, and every row ID beneath it, is not.
 */
function matchesContent(
  actual: unknown,
  expected: unknown,
  generatedIds: Set<string>,
  volatileId = false,
): boolean {
  if (isDeepStrictEqual(actual, expected)) return true
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((item, i) => matchesContent(actual[i], item, generatedIds))
    )
  }
  if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object')
    return false
  const a = actual as Record<string, unknown>
  const e = expected as Record<string, unknown>
  const ignoreId = volatileId || (typeof e.id === 'string' && generatedIds.has(e.id))
  const keys = (value: Record<string, unknown>) =>
    Object.keys(value)
      .filter((k) => !(ignoreId && k === 'id'))
      .sort()
  return (
    isDeepStrictEqual(keys(a), keys(e)) &&
    keys(e).every((k) =>
      matchesContent(a[k], e[k], generatedIds, e.type === 'block' && k === 'fields'),
    )
  )
}
