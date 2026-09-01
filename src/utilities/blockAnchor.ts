import { toKebabCase } from './toKebabCase'

/**
 * An in-page anchor derived from a layout block's name.
 *
 * Every Payload block already carries an optional `blockName` — the label an
 * editor gives a row in the layout builder — so turning it into an `id` gives
 * them a way to link to one block ("#register" on the Forum page) with no new
 * field and no migration. Unnamed blocks stay unanchored, and a name reused on
 * two blocks is suffixed rather than emitting a duplicate id.
 *
 * `taken` accumulates the ids already used on the page, so pass the same set
 * through one render.
 */
export const blockAnchor = (blockName: unknown, taken: Set<string>): string | undefined => {
  if (typeof blockName !== 'string' || !blockName.trim()) return undefined

  const base = toKebabCase(blockName)
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (!base) return undefined

  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
  taken.add(id)
  return id
}
