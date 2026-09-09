import { isDeepStrictEqual } from 'node:util'

export type ContentChange = {
  collection: 'pages' | 'posts' | 'workstreams' | 'people'
  match: { field: 'slug' | 'name'; value: string }
  before: Record<string, unknown>
  after: Record<string, unknown>
  generatedIds?: string[]
}
export type ContentPlan = { version: 1; name: string; changes: ContentChange[] }

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
  ],
  people: ['role', 'bio'],
}

export function validatePlan(value: unknown): ContentPlan {
  const plan = value as ContentPlan
  if (plan?.version !== 1 || !plan.name || !Array.isArray(plan.changes) || !plan.changes.length) {
    throw new Error('Invalid content plan')
  }
  const seen = new Set<string>()
  for (const change of plan.changes) {
    const fields = allowedFields[change.collection]
    if (
      !fields ||
      !change.match?.value ||
      change.match.field !== (change.collection === 'people' ? 'name' : 'slug') ||
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
  return plan
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
