import { describe, expect, it } from 'vitest'
import { workstreamHierarchy, workstreamNavigation } from '@/utilities/workstreamHierarchy'

// Invented records: their internal sort values are not public numbering.
const records = [
  { title: 'Alliances', slug: 'alliances', number: 10, group: 'digit' as const },
  { title: 'Trials', slug: 'trials', number: 20, group: 'digit' as const },
  { title: 'Experience', slug: 'experience', number: 30, group: 'digit' as const },
  { title: 'Adoption', slug: 'adoption', number: 40, group: null },
  { title: 'Data', slug: 'data', number: 50, group: null },
  { title: 'Cohorts', slug: 'cohorts', number: 60, group: null },
]

describe('national workstreams and DIGIT strands', () => {
  it('groups three strands as one national workstream while preserving records and URLs', () => {
    const before = structuredClone(records)
    const groups = workstreamHierarchy([...records].reverse())
    expect(groups.map(({ label, href }) => [label, href])).toEqual([
      ['01', '/digit'],
      ['02', '/workstreams/adoption'],
      ['03', '/workstreams/data'],
      ['04', '/workstreams/cohorts'],
    ])
    expect(groups[0].children.map(({ label, kind, href }) => [label, kind, href])).toEqual([
      ['1A', 'strand', '/workstreams/alliances'],
      ['1B', 'strand', '/workstreams/trials'],
      ['1C', 'strand', '/workstreams/experience'],
    ])
    expect(groups[0].children[0].doc).toBe(records[0])
    expect(records).toEqual(before)
  })

  it('includes the parent in navigation rather than cycling from the final workstream to a strand', () => {
    const nav = workstreamNavigation(records)
    expect(nav.map(({ href }) => href)).toEqual([
      '/digit',
      '/workstreams/alliances',
      '/workstreams/trials',
      '/workstreams/experience',
      '/workstreams/adoption',
      '/workstreams/data',
      '/workstreams/cohorts',
    ])
    expect(nav[(nav.length - 1 + 1) % nav.length].href).toBe('/digit')
  })

  it('does not invent DIGIT or links when there are no strand records or no slugs', () => {
    expect(workstreamHierarchy([])).toEqual([])
    const groups = workstreamHierarchy([records[3], { ...records[0], slug: '' }])
    expect(groups.map(({ href, label }) => [href, label])).toEqual([
      ['/workstreams/adoption', '01'],
    ])
  })
})
