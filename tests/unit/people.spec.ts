import { describe, expect, it } from 'vitest'

import { comparePeople, sortPeople, surname } from '@/utilities/people'

const ws = (number: number, title = `WS ${number}`) => ({ id: number, number, title }) as never

// Invented names throughout. This exercises the comparator, not the team —
// the real team lives in the production CMS, and a unit test that names them
// would go stale the first time somebody joins or leaves.
describe('surname', () => {
  it('takes the last word, whatever the honorific', () => {
    expect(surname('Prof. Ada Fenwick')).toBe('fenwick')
    expect(surname('Dr Siân Quill')).toBe('quill')
    expect(surname('Non Hill')).toBe('hill')
  })
})

describe('sortPeople', () => {
  it('orders by workstream number, then surname, then forename', () => {
    const out = sortPeople([
      { name: 'Prof. James Wray', workstreams: [ws(6)] },
      { name: 'Dr Matthias Osric', workstreams: [ws(1), ws(5)] },
      { name: 'Prof. Gerome Bramley', workstreams: [ws(6)] },
      { name: 'Prof. Ada Fenwick', workstreams: [ws(1)] },
      { name: 'Prof. Edward Halloway', workstreams: [ws(3)] },
      { name: 'Dr Siân Quill', workstreams: [ws(3)] },
    ])
    expect(out.map((p) => p.name)).toEqual([
      'Prof. Ada Fenwick',
      'Dr Matthias Osric',
      'Prof. Edward Halloway',
      'Dr Siân Quill',
      'Prof. Gerome Bramley',
      'Prof. James Wray',
    ])
  })

  it('puts people with no workstream first — the co-chairs sit above the workstreams', () => {
    const out = sortPeople([
      { name: 'Dr Vera Tarrant', workstreams: [ws(1)] },
      { name: 'Prof. Husseini Ashby', workstreams: [] },
      { name: 'Prof. Kathryn Alder', workstreams: undefined },
    ])
    expect(out.map((p) => p.name)).toEqual([
      'Prof. Kathryn Alder',
      'Prof. Husseini Ashby',
      'Dr Vera Tarrant',
    ])
  })

  it('is stable for two people who share a workstream and a surname', () => {
    // Forename breaks the tie, so the order cannot depend on insertion.
    const a = { name: 'Dr Ann Smith', workstreams: [ws(2)] }
    const b = { name: 'Dr Zoe Smith', workstreams: [ws(2)] }
    expect(comparePeople(a, b)).toBeLessThan(0)
    expect(comparePeople(b, a)).toBeGreaterThan(0)
  })

  it('does not mutate its input', () => {
    const input = [
      { name: 'B B', workstreams: [] },
      { name: 'A A', workstreams: [] },
    ]
    sortPeople(input)
    expect(input[0].name).toBe('B B')
  })
})
