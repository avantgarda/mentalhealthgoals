/**
 * What site search can return, and how each kind is presented.
 *
 * One table, read by four places: the plugin's `collections` list, the `type`
 * field's options, `beforeSync` when it stamps a document, and the results UI
 * when it labels one. Adding a collection to search means adding a row here —
 * and a migration, since the search document's polymorphic relationship gains
 * a column.
 */
export const RESULT_TYPES = [
  { value: 'page', label: 'Page', collection: 'pages', priority: 30 },
  { value: 'workstream', label: 'Workstream', collection: 'workstreams', priority: 25 },
  { value: 'post', label: 'News & events', collection: 'posts', priority: 20 },
  { value: 'person', label: 'Person', collection: 'people', priority: 10 },
] as const

export type ResultType = (typeof RESULT_TYPES)[number]['value']

/** Collections the search plugin indexes. */
export const SEARCHED_COLLECTIONS: string[] = RESULT_TYPES.map((entry) => entry.collection)

/**
 * Ranks one kind of result above another where a query matches both — a page
 * about industry engagement should outrank a person who works on it.
 */
export const SEARCH_PRIORITIES: Record<string, number> = Object.fromEntries(
  RESULT_TYPES.map((entry) => [entry.collection, entry.priority]),
)

export const resultTypeFor = (collection: string): ResultType | undefined =>
  RESULT_TYPES.find((entry) => entry.collection === collection)?.value

export const resultLabel = (value?: string | null): string =>
  RESULT_TYPES.find((entry) => entry.value === value)?.label ?? ''
