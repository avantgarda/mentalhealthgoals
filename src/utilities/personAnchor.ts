/**
 * Stable anchor for a person, so their name can be linked from anywhere on the
 * site — the Team page gives each card this as its `id`, and workstream pages
 * and search results link to `/people#<anchor>`.
 *
 * Honorifics are stripped so that "Prof. Mitul Mehta" and "Mitul Mehta" resolve
 * to the same anchor and an existing link survives a title being added later.
 */
export const personAnchor = (name: string) =>
  name
    .toLowerCase()
    .replace(/prof\.?|dr\.?/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
