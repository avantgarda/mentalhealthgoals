/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DefaultTypedEditorState } from '@payloadcms/richtext-lexical'

type Split = {
  /** The first heading node on its own, if any. */
  heading: DefaultTypedEditorState | null
  /** Plain text of that heading (for custom rendering), empty when none. */
  headingText: string
  /** Everything except the first heading, or null when nothing remains. */
  rest: DefaultTypedEditorState | null
}

const textOf = (node: any): string => {
  if (!node) return ''
  if (typeof node.text === 'string') return node.text
  if (Array.isArray(node.children)) return node.children.map(textOf).join('')
  return ''
}

/**
 * The hero editor stores a heading followed by paragraphs. The layouts set
 * those two parts in different places (and different type), so split them.
 */
export const splitRichText = (data: DefaultTypedEditorState | null | undefined): Split => {
  const children: any[] = (data as any)?.root?.children ?? []
  const headingIndex = children.findIndex((n) => n?.type === 'heading')
  const heading = headingIndex >= 0 ? children[headingIndex] : null
  const rest = children.filter((_, i) => i !== headingIndex)

  const build = (nodes: any[]): DefaultTypedEditorState | null =>
    data && nodes.length > 0
      ? ({
          ...(data as any),
          root: { ...(data as any).root, children: nodes },
        } as DefaultTypedEditorState)
      : null

  return {
    heading: heading ? build([heading]) : null,
    headingText: textOf(heading).trim(),
    rest: build(rest),
  }
}

/** First h2 text inside a rich-text document — used as a gutter label. */
export const firstHeadingText = (data: DefaultTypedEditorState | null | undefined): string => {
  const children: any[] = (data as any)?.root?.children ?? []
  const h = children.find((n) => n?.type === 'heading')
  return textOf(h).trim()
}
