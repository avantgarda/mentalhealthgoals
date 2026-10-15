// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { assessChange } from '../../scripts/lib/content-patch-core'
import { change, readerText, relinkToMedia } from '../../scripts/lib/content-plan'
import { link, paragraph, root, text } from '../fixtures/lexical'

/**
 * The content tool turns a typed link to an uploaded PDF into a link that picks
 * the file from Media, then proves each write by reading the record back and
 * comparing it exactly. That proof only holds if Payload stores the converted
 * link exactly as the tool wrote it. Invented post and file, deleted after.
 */
let payload: Payload
const context = { disableRevalidate: true }
const run = Date.now()
const created: { collection: 'media' | 'posts'; id: number }[] = []

/** A one-page blank PDF: enough for Payload's upload checks. */
function blankPdf(name: string) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> >>',
  ]
  let body = '%PDF-1.4\n'
  const offsets = objects.map((object, i) => {
    const offset = Buffer.byteLength(body, 'latin1')
    body += `${i + 1} 0 obj\n${object}\nendobj\n`
    return offset
  })
  const xref = Buffer.byteLength(body, 'latin1')
  body +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  const data = Buffer.from(body, 'latin1')
  return { name, data, mimetype: 'application/pdf', size: data.byteLength }
}

describe('a typed file link converted to a Media link', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    for (const { collection, id } of created.reverse())
      await payload.delete({ collection, id, context })
  })

  it('reads back exactly as the plan wrote it, and reads the same to a visitor', async () => {
    const file = await payload.create({
      collection: 'media',
      context,
      data: { alt: 'Test slides' },
      file: blankPdf(`media-link-test-${run}.pdf`),
    })
    created.push({ collection: 'media', id: file.id })
    const post = await payload.create({
      collection: 'posts',
      context,
      data: {
        title: `Media link test ${run}`,
        slug: `media-link-test-${run}`,
        _status: 'published',
        content: root(
          paragraph(
            text('Download the '),
            link('Test slides (PDF, 1 KB)', `/api/media/file/${file.filename}`),
            text('.'),
          ),
        ),
      },
    })
    created.push({ collection: 'posts', id: post.id })

    // As the tool reads a record: depth 0, latest draft, a plain object.
    const read = async () =>
      (await payload.findByID({
        collection: 'posts',
        id: post.id,
        depth: 0,
        draft: true,
      })) as unknown as Record<string, unknown> & { id: number }
    const baseline = await read()
    const content = structuredClone(baseline.content)
    expect(relinkToMedia(content, { media: [file] })).toEqual([file.filename])
    const planned = change('posts', baseline, { content })
    expect(assessChange(baseline, planned)).toBe('ready')

    await payload.update({
      collection: 'posts',
      id: post.id,
      context,
      depth: 0,
      data: planned.after,
    })
    const saved = await read()
    expect(assessChange(saved, planned)).toBe('already applied')

    const [before, after] = [baseline, saved].map(
      (doc) => (doc.content as { root: { children: unknown[] } }).root.children[0],
    )
    expect(readerText(after, { media: [file] })).toBe(readerText(before))
    expect(readerText(after, { media: [file] })).toBe('Download the Test slides (PDF, 1 KB).')
  })
})
