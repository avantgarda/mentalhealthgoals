import { isDeepStrictEqual } from 'node:util'

export type ContentChange = {
  collection: 'pages' | 'workstreams' | 'people'
  match: { field: 'slug' | 'name'; value: string }
  before: Record<string, unknown>
  after: Record<string, unknown>
  generatedIds?: string[]
}
export type ContentPlan = { version: 1; name: string; changes: ContentChange[] }

const allowedFields: Record<ContentChange['collection'], string[]> = {
  pages: ['layout', 'hero', 'meta'],
  workstreams: [
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
    const identity = `${change.collection}/${change.match.value}`
    if (seen.has(identity)) throw new Error(`Duplicate content target: ${identity}`)
    seen.add(identity)
  }
  return plan
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
 */
function matchesContent(actual: unknown, expected: unknown, generatedIds: Set<string>): boolean {
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
  const ignoreId = typeof e.id === 'string' && generatedIds.has(e.id)
  const keys = (value: Record<string, unknown>) =>
    Object.keys(value)
      .filter((k) => !(ignoreId && k === 'id'))
      .sort()
  return (
    isDeepStrictEqual(keys(a), keys(e)) &&
    keys(e).every((k) => matchesContent(a[k], e[k], generatedIds))
  )
}
