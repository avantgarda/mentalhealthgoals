import type { SerializedAutoLinkNode, SerializedLinkNode } from '@payloadcms/richtext-lexical'
import {
  LinkJSXConverter,
  type JSXConverterArgs,
  type JSXConverters,
} from '@payloadcms/richtext-lexical/react'

import type { Media } from '@/payload-types'
import { fileLabel } from '@/utilities/fileLabel'

const defaultLinks = LinkJSXConverter({
  // Only reached for a page or post that arrived: `link` below checks first.
  internalDocToHref: ({ linkNode }) => {
    const { value, relationTo } = linkNode.fields.doc as {
      relationTo: string
      value: { slug?: string }
    }
    return relationTo === 'posts' ? `/posts/${value.slug}` : `/${value.slug}`
  },
})

const renderDefaultLink = defaultLinks.link as (
  args: JSXConverterArgs<SerializedLinkNode>,
) => React.ReactNode

/**
 * Rich-text links. Custom URLs, and internal links to pages and posts, render
 * as the Payload template always has. Two cases differ:
 *
 * - A link to an uploaded file (Media) goes to the file and says what it is:
 *   "Slides (PDF, 2.3 MB)". Editors pick the file; they never type the size.
 * - An internal link whose target did not arrive — the document was deleted,
 *   or the page was read too shallow to fetch it — keeps its words and drops
 *   the link, rather than pointing at `/undefined`.
 */
export const linkConverters: JSXConverters<SerializedAutoLinkNode | SerializedLinkNode> = {
  ...defaultLinks,
  link: (args) => {
    const { node, nodesToJSX } = args
    if (node.fields.linkType !== 'internal') return renderDefaultLink(args)

    const children = nodesToJSX({ nodes: node.children })
    const doc = node.fields.doc
    if (!doc || typeof doc.value !== 'object' || doc.value === null) return <>{children}</>
    if (doc.relationTo !== 'media') return renderDefaultLink(args)

    const media = doc.value as unknown as Media
    if (!media.url) return <>{children}</>
    const label = fileLabel(media)

    return (
      <a
        href={media.url}
        rel={node.fields.newTab ? 'noopener noreferrer' : undefined}
        target={node.fields.newTab ? '_blank' : undefined}
      >
        {children}
        {label && ` (${label})`}
      </a>
    )
  },
}
