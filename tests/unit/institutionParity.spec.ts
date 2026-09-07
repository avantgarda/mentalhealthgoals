import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'fs'
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

const from = (...segments: string[]) => path.resolve(import.meta.dirname, '../..', ...segments)

/**
 * Directories of written copy. Most of the site's words now live in the
 * production CMS, where a test cannot reach them — what stays here is the
 * fixture and the components that write their own copy. A missing directory is
 * skipped rather than fatal, so this survives the next reorganisation.
 */
const COPY_DIRS = ['tests/fixtures'].map((dir) => from(dir))

/** Components that write their own copy, and must always be checked. */
const COMPONENTS = [
  from('src/Footer/Component.tsx'),
  from('src/blocks/Workstreams/Component.tsx'),
  from('src/blocks/People/Component.tsx'),
]

const inDir = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((file) => file.endsWith('.ts'))
        .map((file) => path.join(dir, file))
    : []

const sources = [...COPY_DIRS.flatMap(inDir), ...COMPONENTS]

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
    // A readdir that silently returns nothing would make every test above
    // pass by scanning no copy at all. Naming what must be there catches
    // that, and keeps working when one of the copy directories goes away.
    expect(sources).toEqual(expect.arrayContaining(COMPONENTS))
    for (const dir of COPY_DIRS.filter(existsSync)) {
      expect(inDir(dir).length, `${path.basename(dir)} contributed no files`).toBeGreaterThan(0)
    }
  })
})
