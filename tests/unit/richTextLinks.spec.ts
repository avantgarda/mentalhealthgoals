import { RichText } from '@payloadcms/richtext-lexical/react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

// The converters the site's RichText uses, without the blocks it also
// registers: those pull in the admin UI's stylesheets, which vitest cannot load.
import { linkConverters } from '@/components/RichText/links'

import { paragraph, root, text } from '../fixtures/lexical'

/** A link node as Payload stores it, with `doc` as the page reads it back. */
const linkNode = (label: string, fields: Record<string, unknown>) => ({
  type: 'link',
  children: [text(label)],
  direction: 'ltr',
  fields: { newTab: false, ...fields },
  format: '',
  indent: 0,
  version: 3,
})

const internal = (relationTo: string, value: unknown, extra: Record<string, unknown> = {}) =>
  linkNode('Opening slides', { linkType: 'internal', doc: { relationTo, value }, ...extra })

const slides = {
  id: 7,
  alt: 'Opening slides (PDF)',
  filename: 'opening-slides.pdf',
  url: '/api/media/file/opening-slides.pdf',
  mimeType: 'application/pdf',
  filesize: 2_340_806,
}

const render = (link: unknown) =>
  renderToStaticMarkup(
    createElement(RichText, {
      converters: ({ defaultConverters }) => ({ ...defaultConverters, ...linkConverters }),
      data: root(paragraph(text('See the '), link, text('.'))),
      disableContainer: true,
    }),
  )

describe('rich-text links to uploaded files', () => {
  it('go to the file and say its type and size', () => {
    expect(render(internal('media', slides))).toContain(
      '<a href="/api/media/file/opening-slides.pdf">Opening slides (PDF, 2.3 MB)</a>',
    )
  })

  it('open in a new tab when the editor asked', () => {
    const html = render(internal('media', slides, { newTab: true }))
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('leave the words in place when the file did not arrive', () => {
    // A deleted upload, or a read too shallow to fetch it: just the id.
    const html = render(internal('media', 7))
    expect(html).not.toContain('<a')
    expect(html).toContain('See the Opening slides.')
  })
})

describe('rich-text links to pages and posts', () => {
  it('still point at the page or post', () => {
    expect(render(internal('pages', { id: 1, slug: 'about' }))).toContain(
      '<a href="/about">Opening slides</a>',
    )
    expect(render(internal('posts', { id: 2, slug: 'annual-report' }))).toContain(
      '<a href="/posts/annual-report">Opening slides</a>',
    )
  })

  it('render the words without a link, rather than throwing, when the target is gone', () => {
    for (const doc of [{ relationTo: 'pages', value: 1 }, null]) {
      const html = render(linkNode('Opening slides', { linkType: 'internal', doc }))
      expect(html).not.toContain('<a')
      expect(html).toContain('See the Opening slides.')
    }
  })
})

describe('custom URL links', () => {
  it('are unchanged, including a typed path to a file', () => {
    const typed = '/api/media/file/opening-slides.pdf'
    expect(
      render(linkNode('Opening slides (PDF, 2.3 MB)', { linkType: 'custom', url: typed })),
    ).toContain(`<a href="${typed}">Opening slides (PDF, 2.3 MB)</a>`)
  })
})
