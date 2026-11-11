import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, it, expect } from 'vitest'
import {
  declareUpload,
  readUploadFile,
  imagePlacements,
  renderReview,
} from '../../scripts/lib/content-plan'
import {
  validatePlan,
  resolveReferences,
  type ContentPlan,
} from '../../scripts/lib/content-patch-core'

describe('reviewed image uploads', () => {
  it.each(['png', 'jpeg'] as const)(
    'decodes %s, locks reviewed bytes and resolves image placements',
    async (format) => {
      const dir = mkdtempSync(join(tmpdir(), 'mhg-image-'))
      try {
        const bytes = await sharp({
          create: { width: 32, height: 24, channels: 3, background: '#346578' },
        })
          .toFormat(format)
          .toBuffer()
        const file = `meeting.${format === 'jpeg' ? 'jpg' : 'png'}`
        writeFileSync(join(dir, file), bytes)
        const upload = declareUpload(dir, {
          file,
          filename: file,
          reference: '__MEDIA_MEETING__',
          alt: 'Meeting participants',
        })
        const plan: ContentPlan = {
          version: 1,
          name: 'Meeting images',
          uploadMedia: [upload],
          changes: [
            {
              collection: 'pages',
              match: { field: 'slug', value: 'about' },
              before: { layout: [] },
              after: { layout: [{ blockType: 'mediaBlock', media: upload.reference }] },
            },
          ],
        }
        expect(validatePlan(plan)).toBe(plan)
        expect(renderReview(plan)).toContain(`![Reviewed image](${file})`)
        const resolved = resolveReferences(plan, new Map([[upload.reference, 77]]))
        expect(imagePlacements(resolved.changes[0])).toEqual([{ path: 'layout[0].media', id: 77 }])
        for (const after of [
          { hero: { type: 'mediumImpact', media: upload.reference } },
          { heroImage: upload.reference },
        ]) {
          const hero = 'heroImage' in after
          const p = {
            ...plan,
            changes: [
              {
                collection: hero ? ('posts' as const) : ('pages' as const),
                match: { field: 'slug' as const, value: 'launch' },
                before: hero ? { heroImage: null } : { hero: null },
                after,
              },
            ],
          }
          expect(() => validatePlan(p)).not.toThrow()
        }
        expect(() =>
          validatePlan({
            ...plan,
            changes: [
              {
                ...plan.changes[0],
                before: { hero: null },
                after: { hero: { type: 'highImpact', media: upload.reference } },
              },
            ],
          }),
        ).toThrow(/Media reference/)
        writeFileSync(join(dir, file), await sharp(bytes).negate().toFormat(format).toBuffer())
        expect(() => readUploadFile(dir, upload)).toThrow(/changed since/)
        writeFileSync(join(dir, file), Buffer.from('not an image'))
        expect(() => readUploadFile(dir, upload)).toThrow(/not a valid/)
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    },
  )
  it('rejects a JPEG disguised as PNG', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mhg-image-'))
    try {
      writeFileSync(
        join(dir, 'fake.png'),
        await sharp({ create: { width: 8, height: 8, channels: 3, background: 'red' } })
          .jpeg()
          .toBuffer(),
      )
      expect(() =>
        declareUpload(dir, {
          file: 'fake.png',
          filename: 'fake.png',
          reference: '__MEDIA_FAKE__',
          alt: 'Fake',
        }),
      ).toThrow(/not a valid/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
