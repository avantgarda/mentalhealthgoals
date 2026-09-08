import { isDeepStrictEqual } from 'node:util'

export type ContentChange = {
  collection: 'pages' | 'workstreams' | 'people'
  match: { field: 'slug' | 'name'; value: string }
  before: Record<string, unknown>
  after: Record<string, unknown>
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
    const identity = `${change.collection}/${change.match.value}`
    if (seen.has(identity)) throw new Error(`Duplicate content target: ${identity}`)
    seen.add(identity)
  }
  return plan
}

export function assessChange(doc: Record<string, unknown>, change: ContentChange) {
  const pick = Object.fromEntries(Object.keys(change.after).map((key) => [key, doc[key]]))
  if (isDeepStrictEqual(pick, change.after)) return 'already applied'
  if (!isDeepStrictEqual(pick, change.before)) {
    throw new Error(
      `Content differs from reviewed baseline: ${change.collection}/${change.match.value}`,
    )
  }
  return 'ready'
}
