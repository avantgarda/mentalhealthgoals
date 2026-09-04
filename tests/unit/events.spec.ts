import { describe, expect, it } from 'vitest'

import { excludingIds, startOfToday } from '@/utilities/events'

describe('startOfToday', () => {
  it('is midnight this morning, so an event today still counts as coming up', () => {
    const parsed = new Date(startOfToday())
    const now = new Date()

    expect(parsed.getHours()).toBe(0)
    expect(parsed.getMinutes()).toBe(0)
    expect(parsed.getSeconds()).toBe(0)
    expect(parsed.getDate()).toBe(now.getDate())
    expect(parsed.getMonth()).toBe(now.getMonth())
    expect(parsed.getFullYear()).toBe(now.getFullYear())
    expect(parsed.getTime()).toBeLessThanOrEqual(now.getTime())
  })
})

describe('excludingIds', () => {
  it('returns undefined when nothing is pinned, so the listing query stays unfiltered', () => {
    // A `where` of undefined is the difference between "show everything" and
    // an id filter that matches nothing.
    expect(excludingIds([])).toBeUndefined()
  })

  it('excludes the pinned events by id', () => {
    expect(excludingIds([3, 7])).toEqual({ id: { not_in: [3, 7] } })
  })
})
