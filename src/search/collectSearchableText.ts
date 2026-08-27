import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'

/** The editor state shape the plaintext converter accepts. `lexical` is not a
 *  direct dependency, so the type is taken from the converter itself. */
type EditorState = Parameters<typeof convertLexicalToPlaintext>[0]['data']

/**
 * Flattens a document down to the words someone might search for.
 *
 * The search plugin stores a title and whatever `beforeSync` adds; on its own
 * that means only titles and meta descriptions are searchable, so a phrase from
 * the middle of a page finds nothing. This walks the parts of each collection
 * that carry prose and returns them as one blob for the `body` field to match
 * `like` against.
 *
 * Blocks that only render *other* indexed documents — the workstream grid, the
 * team grid — are skipped: those documents are in the index in their own right,
 * and copying their titles into every page that lists them would make the page
 * outrank the thing itself.
 */

const isRichText = (value: unknown): value is EditorState =>
  Boolean(value) && typeof value === 'object' && 'root' in (value as Record<string, unknown>)

const fromRichText = (value: unknown): string => {
  if (!isRichText(value)) return ''
  try {
    return convertLexicalToPlaintext({ data: value })
  } catch {
    // A malformed editor state must never stop a document being indexed.
    return ''
  }
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

type Doc = Record<string, unknown>

const asDoc = (value: unknown): Doc => (value && typeof value === 'object' ? (value as Doc) : {})
const asRows = (value: unknown): Doc[] => (Array.isArray(value) ? value.map(asDoc) : [])

/** Collects strings from an array of rows, reading the named keys off each. */
const fromRows = (rows: unknown, ...keys: string[]): string[] =>
  asRows(rows).flatMap((row) => keys.map((key) => row[key]).filter(isText))

const fromPageBlock = (block: Doc): string[] => {
  switch (block.blockType) {
    case 'content':
      return asRows(block.columns).map((column) => fromRichText(column.richText))
    case 'cta':
      return [fromRichText(block.richText)]
    case 'archive':
    case 'formBlock':
      return [fromRichText(block.introContent)]
    case 'stats':
      return fromRows(block.items, 'value', 'label', 'sublabel')
    case 'eventDetails':
      return [
        ...[block.agendaHeading, block.outcomesHeading].filter(isText),
        ...fromRows(block.facts, 'label', 'value'),
        ...fromRows(block.agenda, 'time', 'item'),
        ...fromRows(block.outcomes, 'title', 'description'),
      ]
    // mediaBlock carries only a caption, and workstreamsBlock/peopleBlock render
    // documents that are indexed separately.
    default:
      return []
  }
}

const collectors: Record<string, (doc: Doc) => unknown[]> = {
  pages: (doc) => [
    fromRichText(asDoc(doc.hero).richText),
    ...asRows(doc.layout).flatMap(fromPageBlock),
  ],
  posts: (doc) => [fromRichText(doc.content)],
  workstreams: (doc) => [
    doc.summary,
    doc.description,
    doc.deliveredBy,
    doc.boundaryStatement,
    ...fromRows(doc.primaryFocus, 'point'),
    ...fromRows(doc.keyQuestions, 'point'),
    ...fromRows(doc.differentiators, 'point'),
    ...fromRows(doc.resources, 'label'),
  ],
  people: (doc) => [doc.role, doc.organisation, doc.bio],
}

export const collectSearchableText = (collection: string, doc: Doc): string =>
  (collectors[collection]?.(doc) ?? [])
    .filter(isText)
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
