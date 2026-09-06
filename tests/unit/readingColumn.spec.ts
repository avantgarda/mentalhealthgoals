import { describe, expect, it } from 'vitest'

import { readingColumn } from '@/utilities/readingColumn'

describe('readingColumn', () => {
  it('steps right to clear a gutter that is actually there', () => {
    expect(readingColumn(true)).toBe('lg:col-span-8 lg:col-start-5')
    expect(readingColumn(true, 'wide')).toBe('lg:col-span-7 lg:col-start-6')
  })

  it('never offsets past a gutter that is empty', () => {
    // The bug this exists to prevent: a passage stranded a third of the way
    // across the page with blank ground to its left.
    expect(readingColumn(false)).not.toMatch(/col-start/)
    expect(readingColumn(false, 'wide')).not.toMatch(/col-start/)
  })

  it('keeps the same width either way, so only the offset changes', () => {
    expect(readingColumn(false)).toBe('lg:col-span-8')
    expect(readingColumn(false, 'wide')).toBe('lg:col-span-7')
  })
})
