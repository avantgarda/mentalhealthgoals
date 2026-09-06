import { describe, expect, it } from 'vitest'

import { comparePeople, sortPeople, surname } from '@/utilities/people'

const ws = (number: number, title = `WS ${number}`) => ({ id: number, number, title }) as never

describe('surname', () => {
  it('takes the last word, whatever the honorific', () => {
    expect(surname('Prof. Mitul Mehta')).toBe('mehta')
    expect(surname('Dr Siân Rees')).toBe('rees')
    expect(surname('Non Hill')).toBe('hill')
  })
})

describe('sortPeople', () => {
  it('orders by workstream number, then surname, then forename', () => {
    const out = sortPeople([
      { name: 'Prof. James Walters', workstreams: [ws(6)] },
      { name: 'Dr Matthias Pierce', workstreams: [ws(1), ws(5)] },
      { name: 'Prof. Gerome Breen', workstreams: [ws(6)] },
      { name: 'Prof. Mitul Mehta', workstreams: [ws(1)] },
      { name: 'Prof. Edward Harcourt', workstreams: [ws(3)] },
      { name: 'Dr Siân Rees', workstreams: [ws(3)] },
    ])
    expect(out.map((p) => p.name)).toEqual([
      'Prof. Mitul Mehta',
      'Dr Matthias Pierce',
      'Prof. Edward Harcourt',
      'Dr Siân Rees',
      'Prof. Gerome Breen',
      'Prof. James Walters',
    ])
  })

  it('puts people with no workstream first — the co-chairs sit above the workstreams', () => {
    const out = sortPeople([
      { name: 'Dr Vaibhav Narayan', workstreams: [ws(1)] },
      { name: 'Prof. Husseini Manji', workstreams: [] },
      { name: 'Prof. Kathryn Abel', workstreams: undefined },
    ])
    expect(out.map((p) => p.name)).toEqual([
      'Prof. Kathryn Abel',
      'Prof. Husseini Manji',
      'Dr Vaibhav Narayan',
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
