/* eslint-disable @typescript-eslint/no-explicit-any */
// Small helpers for building Lexical rich-text JSON in seed data.

export const text = (t: string, format: number = 0): any => ({
  type: 'text',
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  text: t,
  version: 1,
})

export const bold = (t: string): any => text(t, 1)

export const link = (t: string, url: string, newTab = false): any => ({
  type: 'link',
  children: [text(t)],
  direction: 'ltr',
  fields: {
    linkType: 'custom',
    newTab,
    url,
  },
  format: '',
  indent: 0,
  version: 3,
})

export const paragraph = (...children: any[]): any => ({
  type: 'paragraph',
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  textFormat: 0,
  version: 1,
})

export const heading = (tag: 'h1' | 'h2' | 'h3' | 'h4', ...children: any[]): any => ({
  type: 'heading',
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  tag,
  version: 1,
})

/** Bulleted list — each argument is one list item's children. */
export const bullets = (...items: any[][]): any => ({
  type: 'list',
  listType: 'bullet',
  start: 1,
  tag: 'ul',
  children: items.map((children, i) => ({
    type: 'listitem',
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    value: i + 1,
    version: 1,
  })),
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
})

export const root = (...children: any[]): any => ({
  root: {
    type: 'root',
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
})
