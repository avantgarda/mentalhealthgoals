import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Editorial rule (2026-08-26, reaffirmed 2026-09-01): people never link out.
 * A person's name links to their card on the Team page (/people#anchor) or
 * nowhere; only organisations link externally. External profile pages rot,
 * imply endorsement hierarchies between partners, and leak readers mid-story —
 * and the Cardiff ones are bot-blocked outright.
 *
 * This scans the seed sources and the entity autolinker for URLs shaped like
 * personal profile pages, so the rule fails a test instead of fading into a
 * memory of a conversation.
 */
const PROFILE_URL = /https?:\/\/[^'"\s]*(\/staff\/|\/people\/|\/person\/|\/profile\/|profiles\.)/i

const SOURCES = [
  ...readdirSync(path.resolve(__dirname, '../../src/endpoints/seed'))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => path.resolve(__dirname, '../../src/endpoints/seed', f)),
  path.resolve(__dirname, '../../src/utilities/linkifyEntities.tsx'),
]

describe('editorial rule: people never link out', () => {
  for (const file of SOURCES) {
    it(`${path.basename(file)} contains no personal-profile URLs`, () => {
      const offending = readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line: line.trim(), n: i + 1 }))
        .filter(({ line }) => PROFILE_URL.test(line))
        // The one sanctioned home for a profile URL: People.profileUrl, an
        // admin-side reference field whose own description says "Not
        // published". The rule governs what readers can click, not what
        // editors can consult.
        .filter(({ line }) => !line.startsWith('profileUrl:'))
      expect(offending, JSON.stringify(offending)).toEqual([])
    })
  }
})
