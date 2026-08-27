import { describe, expect, it } from 'vitest'

import { blockAnchor } from '@/utilities/blockAnchor'

/**
 * Block anchors come from the `blockName` an editor types in the layout
 * builder, so they have to survive whatever gets typed there.
 */
describe('blockAnchor', () => {
  const fresh = () => new Set<string>()

  it('slugifies a name into a usable fragment', () => {
    expect(blockAnchor('Register your interest', fresh())).toBe('register-your-interest')
  })

  it('strips punctuation an editor might type', () => {
    expect(blockAnchor('Register — now!', fresh())).toBe('register-now')
    expect(blockAnchor('FAQs & answers', fresh())).toBe('faqs-answers')
  })

  it('leaves unnamed blocks unanchored', () => {
    expect(blockAnchor(undefined, fresh())).toBeUndefined()
    expect(blockAnchor('', fresh())).toBeUndefined()
    expect(blockAnchor('   ', fresh())).toBeUndefined()
    // Nothing usable survives slugifying, so no id rather than an empty one.
    expect(blockAnchor('—', fresh())).toBeUndefined()
  })

  it('suffixes a repeated name instead of emitting a duplicate id', () => {
    const taken = fresh()
    expect(blockAnchor('Register', taken)).toBe('register')
    expect(blockAnchor('Register', taken)).toBe('register-2')
    expect(blockAnchor('Register', taken)).toBe('register-3')
  })
})
