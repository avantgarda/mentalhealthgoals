import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import path from 'path'

/**
 * The site is the public face of a six-workstream, nine-institution
 * programme. Two sentence shapes kept undoing that: naming one institution as
 * the programme's home ("led from X"), and attaching the umbrella team to its
 * host institution ("the Alliance Team at X"). Both read as precedence over
 * the other partners, and both had crept into five separate surfaces before
 * being removed.
 *
 * Legally required statements are exempt by construction: the privacy notice's
 * data-controller and website-operator sentences name King's because the law
 * requires a named controller, and neither matches these patterns.
 */
const BANNED = [
  {
    // Scoped to one sentence about the programme, so the Multi-omics copy —
    // "In severe depression, led from King's... In psychosis, led from
    // Cardiff..." — stays legal. That parallel pair is the parity model.
    pattern: /programme\b[^.]{0,60}\bled from/i,
    why: 'names one institution as the programme’s home; the programme is delivered by nine',
  },
  {
    pattern: /Alliance Team at King’s/,
    why: 'attaches DIGIT to its host institution; say what it delivers instead',
  },
]

const SEED_DIR = path.resolve(import.meta.dirname, '../../src/endpoints/seed')

const sources = [
  ...readdirSync(SEED_DIR)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => path.join(SEED_DIR, file)),
  path.resolve(import.meta.dirname, '../../src/Footer/Component.tsx'),
  path.resolve(import.meta.dirname, '../../src/blocks/Workstreams/Component.tsx'),
  path.resolve(import.meta.dirname, '../../src/blocks/People/Component.tsx'),
]

describe('institution parity in published copy', () => {
  const REPO_ROOT = path.resolve(import.meta.dirname, '../..')

  for (const file of sources) {
    it(`${path.relative(REPO_ROOT, file)} names no single institution as the programme's home`, () => {
      const contents = readFileSync(file, 'utf8')
      const found = BANNED.filter(({ pattern }) => pattern.test(contents)).map(
        ({ pattern, why }) => `${pattern} — ${why}`,
      )
      expect(found).toEqual([])
    })
  }

  it('scans the files it thinks it does', () => {
    expect(sources.length).toBeGreaterThanOrEqual(8)
  })
})
