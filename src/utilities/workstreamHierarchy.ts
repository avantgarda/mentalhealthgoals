import type { Workstream } from '@/payload-types'

type Record = Pick<Workstream, 'title' | 'slug' | 'number' | 'group'>

export const DIGIT = {
  title: 'DIGIT — Data and Digital Industry Alliance Team',
  href: '/digit',
  note: 'One funded project, delivered through three linked strands.',
}

export type WorkstreamEntry<T extends Record> = {
  title: string
  href: string
  label: string
  kind: 'workstream' | 'strand'
  doc?: T
  children: WorkstreamEntry<T>[]
}

/** CMS numbers remain sort keys; grouping determines public numbering. */
export function workstreamHierarchy<T extends Record>(records: T[]): WorkstreamEntry<T>[] {
  const groups: WorkstreamEntry<T>[] = []
  let digit: WorkstreamEntry<T> | undefined
  for (const doc of [...records].sort((a, b) => a.number - b.number)) {
    if (!doc.slug) continue
    if (doc.group === 'digit') {
      if (!digit) {
        digit = {
          ...DIGIT,
          label: String(groups.length + 1).padStart(2, '0'),
          kind: 'workstream',
          children: [],
        }
        groups.push(digit)
      }
      digit.children.push({
        doc,
        title: doc.title,
        href: `/workstreams/${doc.slug}`,
        label: `${Number(digit.label)}${String.fromCharCode(65 + digit.children.length)}`,
        kind: 'strand',
        children: [],
      })
    } else {
      groups.push({
        doc,
        title: doc.title,
        href: `/workstreams/${doc.slug}`,
        label: String(groups.length + 1).padStart(2, '0'),
        kind: 'workstream',
        children: [],
      })
    }
  }
  return groups
}

/** Includes DIGIT itself so the final workstream returns to the parent page. */
export function workstreamNavigation<T extends Record>(records: T[]) {
  return workstreamHierarchy(records).flatMap((entry) => [entry, ...entry.children])
}
