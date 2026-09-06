import type { Person, Workstream } from '@/payload-types'

/**
 * The team is listed in the same order everywhere: by the workstream someone
 * works on, then by surname. Nobody is ordered by hand — a manual order is a
 * ranking, and on a programme of nine institutions a ranking is a statement.
 *
 * Someone on more than one workstream is placed by the lowest-numbered;
 * someone on none (the programme's co-chairs) comes first, ahead of every
 * workstream, since they sit above the workstreams rather than inside one.
 */
export const workstreamNumbers = (person: Pick<Person, 'workstreams'>): number[] =>
  (person.workstreams ?? [])
    .map((entry) =>
      typeof entry === 'object' && entry !== null ? (entry as Workstream).number : null,
    )
    .filter((n): n is number => typeof n === 'number')

export const workstreamTitles = (person: Pick<Person, 'workstreams'>): string[] =>
  (person.workstreams ?? [])
    .map((entry) =>
      typeof entry === 'object' && entry !== null ? (entry as Workstream).title : null,
    )
    .filter((title): title is string => Boolean(title))

/** "Prof. Mitul Mehta" → "mehta"; the last word is the surname for everyone on the team. */
export const surname = (name: string): string => name.trim().split(/\s+/).pop()?.toLowerCase() ?? ''

/** Everything before the surname, honorific stripped, for tie-breaking. */
const forename = (name: string): string =>
  name
    .trim()
    .replace(/^(prof\.?|professor|dr\.?)\s+/i, '')
    .split(/\s+/)
    .slice(0, -1)
    .join(' ')
    .toLowerCase()

export const comparePeople = (
  a: Pick<Person, 'name' | 'workstreams'>,
  b: Pick<Person, 'name' | 'workstreams'>,
): number => {
  const wa = Math.min(...workstreamNumbers(a), Infinity)
  const wb = Math.min(...workstreamNumbers(b), Infinity)
  // No workstream sorts first, not last.
  const ka = wa === Infinity ? 0 : wa
  const kb = wb === Infinity ? 0 : wb
  if (ka !== kb) return ka - kb
  const s = surname(a.name).localeCompare(surname(b.name), 'en')
  if (s !== 0) return s
  return forename(a.name).localeCompare(forename(b.name), 'en')
}

export const sortPeople = <T extends Pick<Person, 'name' | 'workstreams'>>(people: T[]): T[] =>
  [...people].sort(comparePeople)
