import type { RequiredDataFromCollectionSlug } from 'payload'

import { heading, link, paragraph, root, text } from './lexical'

// Used for pre-seeded content so that the homepage is not empty
export const homeStatic: RequiredDataFromCollectionSlug<'pages'> = {
  slug: 'home',
  _status: 'published',
  hero: {
    type: 'lowImpact',
    richText: root(
      heading('h1', text('Mental Health Goals Programme')),
      paragraph(
        link('Visit the admin dashboard', '/admin'),
        text(' to make your account and seed content for this website.'),
      ),
    ),
  },
  meta: {
    description: 'A UK Government-backed national programme transforming mental health research.',
    title: 'Mental Health Goals Programme',
  },
  title: 'Home',
  layout: [],
}
