#!/usr/bin/env tsx
/**
 * load.ts — put the test fixture into the local database.
 *
 *   pnpm fixture
 *
 * The suite used to run against the content seed, which meant the tests
 * asserted on the programme's real copy: a copy change and a rendering
 * regression failed the same way. Content lives in the production CMS now, so
 * the tests bring their own — invented people, invented institutions, and just
 * enough shape to exercise every path the site renders.
 *
 * It runs as its own process rather than from a Playwright globalSetup,
 * deliberately. Importing the Payload config into the Playwright process drags
 * `next/cache` in behind it, which is a resolution failure waiting to happen
 * and has been one before.
 *
 * Images are generated here rather than committed: two flat rectangles a few
 * hundred bytes each. The tests care that an image is present and has
 * dimensions, not what it depicts.
 */

import { createLocalReq, getPayload, type CollectionSlug, type File, type Payload } from 'payload'
import sharp from 'sharp'

import config from '@payload-config'

import { FIXTURE, partners, people, workstreams } from './site'
import { block, bullets, heading, inlineBlock, paragraph, root, text } from './lexical'

/**
 * Cleared dependents first. Parallel deletes here caused a Postgres deadlock in
 * production once — search and posts take conflicting foreign-key lock orders —
 * so this stays sequential and in this order.
 */
const COLLECTIONS: CollectionSlug[] = [
  'search',
  'form-submissions',
  'posts',
  'pages',
  'forms',
  'workstreams',
  'people',
  'categories',
  'partners',
  'media',
]

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

function assertLocalDatabase(): void {
  let host = ''
  try {
    host = new URL(process.env.DATABASE_URL ?? '').hostname
  } catch {
    host = ''
  }

  if (!LOCAL_HOSTS.has(host)) {
    console.error(
      `Refusing to load the fixture: DATABASE_URL points at ${host || 'an unparseable host'}, ` +
        'not a local database.\nThis wipes every collection before it writes.',
    )
    process.exit(1)
  }
}

/** A flat rectangle, a few hundred bytes, enough to be a real upload. */
async function swatch(name: string, rgb: [number, number, number], size = 320): Promise<File> {
  const data = await sharp({
    create: {
      width: size,
      height: Math.round(size * 0.66),
      channels: 3,
      background: { r: rgb[0], g: rgb[1], b: rgb[2] },
    },
  })
    .png({ compressionLevel: 9 })
    .toBuffer()

  return { name, data, mimetype: 'image/png', size: data.byteLength }
}

async function wipe(payload: Payload, req: Awaited<ReturnType<typeof createLocalReq>>) {
  for (const collection of COLLECTIONS) {
    // Media goes through the collection operation, not the db adapter: file
    // deletion runs in the collection's delete hooks, so a db-level wipe
    // strands every uploaded file and the next load finds each filename taken.
    if (collection === 'media') {
      await payload.delete({ collection, depth: 0, req, where: {} })
    } else {
      await payload.db.deleteMany({ collection, req, where: {} })
    }
  }

  for (const collection of COLLECTIONS) {
    if (payload.collections[collection].config.versions) {
      await payload.db.deleteVersions({ collection, req, where: {} })
    }
  }

  for (const slug of ['header', 'footer'] as const) {
    await payload.updateGlobal({
      slug,
      data: { navItems: [] },
      depth: 0,
      context: { disableRevalidate: true },
    })
  }
}

async function load(): Promise<void> {
  assertLocalDatabase()

  const payload = await getPayload({ config })
  const noRevalidate = { context: { disableRevalidate: true } }

  let admin = (
    await payload.find({
      collection: 'users',
      where: { email: { equals: FIXTURE.admin.email } },
      limit: 1,
    })
  ).docs[0]

  if (!admin) {
    admin = await payload.create({
      collection: 'users',
      data: { ...FIXTURE.admin, role: 'admin' },
    })
  }

  const req = await createLocalReq({ user: admin }, payload)

  payload.logger.info('— Clearing collections and globals...')
  await wipe(payload, req)

  payload.logger.info('— Media...')
  const [heroImage, cardImage, portrait, logoImage] = await Promise.all([
    payload
      .create({
        collection: 'media',
        data: { alt: 'A flat teal rectangle standing in for the hero image' },
        file: await swatch('fixture-hero.png', [12, 60, 70], 960),
      })
      .then((doc) => doc.id),
    payload
      .create({
        collection: 'media',
        data: { alt: 'A flat amber rectangle standing in for a card image' },
        file: await swatch('fixture-card.png', [176, 118, 40], 640),
      })
      .then((doc) => doc.id),
    payload
      .create({
        collection: 'media',
        data: { alt: 'A flat grey rectangle standing in for a portrait' },
        file: await swatch('fixture-portrait.png', [110, 110, 116], 400),
      })
      .then((doc) => doc.id),
    payload
      .create({
        collection: 'media',
        data: { alt: 'A flat blue rectangle standing in for a partner logo' },
        file: await swatch('fixture-logo.png', [40, 70, 140], 300),
      })
      .then((doc) => doc.id),
  ])

  payload.logger.info('— Partners...')
  const partnerId: Record<string, number> = {}
  for (const partner of partners) {
    const doc = await payload.create({
      collection: 'partners',
      depth: 0,
      ...noRevalidate,
      data: {
        name: partner.name,
        strapline: partner.strapline,
        role: partner.role,
        showInFooter: partner.showInFooter,
        order: partner.order,
        ...(partner.url ? { url: partner.url } : {}),
        ...(partner.withLogo ? { logo: logoImage } : {}),
      },
    })
    partnerId[partner.slug] = doc.id
  }

  payload.logger.info('— Categories...')
  const newsCategory = await payload.create({
    collection: 'categories',
    depth: 0,
    ...noRevalidate,
    data: { title: 'News', slug: 'news' },
  })

  payload.logger.info('— Workstreams...')
  const workstreamId: Record<string, number> = {}
  for (const ws of workstreams) {
    const isPartnered = ws.slug === FIXTURE.workstream.withPartners.slug
    const doc = await payload.create({
      collection: 'workstreams',
      depth: 0,
      ...noRevalidate,
      data: {
        number: ws.number,
        title: ws.title,
        slug: ws.slug,
        summary: ws.summary,
        description: ws.description,
        deliveredBy: ws.deliveredBy,
        ...(ws.group ? { group: ws.group } : {}),
        // One workstream carries the full detail set, so the page that renders
        // it has something to render; the rest stay bare, which is also a
        // shape the page has to handle.
        ...(ws.slug === FIXTURE.workstream.withSections.slug
          ? {
              boundaryStatement:
                'This workstream covers the cohort itself, and stops where analysis begins.',
              primaryFocus: [
                { point: 'Recruiting and retaining the cohort.' },
                { point: 'Keeping its measures comparable over time.' },
              ],
              keyQuestions: [
                { point: 'Who is missing from the cohort, and why?' },
                { point: 'What can it answer that a smaller study cannot?' },
              ],
              differentiators: [{ point: 'Its size, and the length of its follow-up.' }],
              resources: [{ label: 'An external resource', url: 'https://example.org/resource' }],
            }
          : {}),
        ...(isPartnered
          ? {
              partners: [
                partnerId['national-delivery-body'],
                partnerId['harbour-data-trust'],
                partnerId['meridian-studies-network'],
              ],
            }
          : {}),
      },
    })
    workstreamId[ws.slug] = doc.id
  }

  payload.logger.info('— People...')
  for (const person of people) {
    await payload.create({
      collection: 'people',
      depth: 0,
      ...noRevalidate,
      data: {
        name: person.name,
        role: person.role,
        organisation: person.organisation,
        group: person.group,
        order: person.order,
        bio: person.bio,
        workstreams: person.workstreams.map((slug) => workstreamId[slug]),
        ...(person.withPhoto ? { photo: portrait } : {}),
      },
    })
  }

  payload.logger.info('— Forms...')
  const contactForm = await payload.create({
    collection: 'forms',
    depth: 0,
    data: {
      title: 'Contact',
      // Without a label the submit button renders empty, which axe reports as
      // a critical violation — buttons must have discernible text.
      submitButtonLabel: 'Send your message',
      confirmationType: 'message',
      confirmationMessage: root(paragraph(text(`Thank you — ${FIXTURE.contact.confirmation}.`))),
      fields: [
        { name: 'full-name', blockType: 'text', label: 'Full Name', required: true, width: 100 },
        { name: 'email', blockType: 'email', label: 'Email', required: true, width: 100 },
        { name: 'message', blockType: 'textarea', label: 'Message', required: true, width: 100 },
      ],
    },
  })

  const registerForm = await payload.create({
    collection: 'forms',
    depth: 0,
    data: {
      title: 'Register interest',
      submitButtonLabel: FIXTURE.forum.stickyLabel,
      confirmationType: 'message',
      confirmationMessage: root(paragraph(text(`Thank you — ${FIXTURE.forum.confirmation}.`))),
      fields: [
        { name: 'full-name', blockType: 'text', label: 'Full name', required: true, width: 100 },
        {
          name: 'organisation',
          blockType: 'text',
          label: 'Organisation',
          required: true,
          width: 100,
        },
        {
          name: 'role',
          blockType: 'text',
          label: 'Role or job title',
          required: false,
          width: 100,
        },
        { name: 'email', blockType: 'email', label: 'Email', required: true, width: 100 },
        {
          name: 'attendance',
          blockType: 'select',
          label: 'Will you be attending?',
          required: true,
          width: 100,
          options: [
            { label: 'Yes, I would like to attend', value: 'yes' },
            { label: 'Not this time, but keep me informed', value: 'later' },
            { label: 'No, but please keep me informed', value: 'no' },
          ],
        },
        {
          name: 'requirements',
          blockType: 'textarea',
          label: 'Access or dietary requirements (optional)',
          required: false,
          width: 100,
        },
        {
          name: 'consent',
          blockType: 'checkbox',
          label: 'The Alliance Management Team may contact me about the Forum.',
          required: true,
          width: 100,
        },
      ],
    },
  })

  payload.logger.info('— Pages...')

  /** A plain full-width passage. */
  const passage = (...children: unknown[]) => ({
    blockType: 'content' as const,
    columns: [{ size: 'full' as const, richText: root(...children) }],
  })

  const pages: Record<string, unknown>[] = [
    {
      slug: 'home',
      _status: 'published',
      title: 'Home',
      hero: {
        type: 'highImpact',
        media: heroImage,
        richText: root(
          heading('h1', text(FIXTURE.home.heading)),
          paragraph(
            text(
              'Every name, institution and figure on this site is invented. It exists so the ' +
                'test suite has something to render that is not the real thing.',
            ),
          ),
        ),
      },
      layout: [
        {
          blockType: 'workstreamsBlock',
          heading: 'Six workstreams',
          intro: 'Each one has a distinct role in the fictional programme.',
          style: 'cards',
        },
        {
          // The audience "doors": three linked one-third columns, which the
          // content block sets as rows clickable from edge to edge.
          blockType: 'content',
          columns: FIXTURE.doors.map((door) => ({
            size: 'oneThird' as const,
            richText: root(heading('h3', text(door.heading)), paragraph(text(door.standfirst))),
            enableLink: true,
            link: { type: 'custom' as const, label: door.label, url: door.url },
          })),
        },
        {
          blockType: 'partnerLogos',
          blockName: 'Working with',
          heading: 'Working with',
          partners: [partnerId['harbour-data-trust'], partnerId['meridian-studies-network']],
        },
        {
          blockType: 'cta',
          richText: root(
            heading('h3', text(FIXTURE.forum.heading)),
            paragraph(text('A day of dialogue with industry partners, later this year.')),
          ),
          links: [
            {
              link: {
                type: 'custom',
                appearance: 'default',
                label: 'Find out more',
                url: '/industry-engagement-forum',
              },
            },
          ],
        },
        passage(
          heading('h2', text('What happens here')),
          paragraph(text('A short passage so the home page has body copy under the hero.')),
        ),
      ],
      meta: { title: 'Home', description: 'A fictional programme, for tests.', image: cardImage },
    },
    {
      slug: 'about',
      _status: 'published',
      title: 'About',
      hero: { type: 'lowImpact', richText: root(heading('h1', text('About'))) },
      layout: [
        passage(
          paragraph(
            text('A passage with no heading beside it, so nothing indents past an empty gutter.'),
          ),
        ),
        {
          blockType: 'partnerLogos',
          blockName: 'Our partners',
          heading: 'Our partners',
          partners: [partnerId['westmoor-university'], partnerId['eastvale-university']],
        },
      ],
    },
    {
      slug: 'workstreams',
      _status: 'published',
      title: 'Workstreams',
      hero: { type: 'lowImpact', richText: root(heading('h1', text('Workstreams'))) },
      layout: [{ blockType: 'workstreamsBlock', style: 'detailed' }],
    },
    {
      slug: 'people',
      _status: 'published',
      title: 'Team',
      hero: { type: 'lowImpact', richText: root(heading('h1', text('Team'))) },
      layout: [{ blockType: 'peopleBlock' }, passage(paragraph(text(FIXTURE.closingNote)))],
    },
    {
      slug: 'contact',
      _status: 'published',
      title: 'Contact',
      hero: { type: 'lowImpact', richText: root(heading('h1', text('Contact'))) },
      layout: [
        {
          blockType: 'formBlock',
          blockName: 'Contact',
          form: contactForm.id,
          enableIntro: true,
          introContent: root(
            heading('h2', text('Get in touch')),
            paragraph(text('Tell us who you are and we will reply.')),
          ),
        },
      ],
    },
    {
      slug: 'industry',
      _status: 'published',
      title: 'For industry',
      hero: { type: 'lowImpact', richText: root(heading('h1', text('For industry'))) },
      layout: [
        passage(
          heading('h2', text(FIXTURE.forum.plainName)),
          paragraph(
            text('How industry works with the fictional programme. Write to '),
            // Not typed: the inline block shows whatever Programme details holds.
            inlineBlock({ blockType: 'programmeEmail' }),
            text('.'),
          ),
        ),
        {
          blockType: 'cta',
          richText: root(
            heading('h3', text('The Forum launches this autumn')),
            paragraph(text('A day of dialogue with industry partners.')),
          ),
          links: [
            {
              link: {
                type: 'custom',
                appearance: 'default',
                label: 'Find out more',
                url: '/industry-engagement-forum',
              },
            },
          ],
        },
      ],
    },
    {
      slug: 'industry-engagement-forum',
      _status: 'published',
      title: 'Industry Engagement Forum',
      hero: {
        type: 'mediumImpact',
        media: cardImage,
        richText: root(heading('h1', text(FIXTURE.forum.heading))),
      },
      stickyCta: {
        enabled: true,
        message: FIXTURE.forum.stickyMessage,
        label: FIXTURE.forum.stickyLabel,
        href: '#register',
      },
      layout: [
        passage(
          paragraph(text('What the Forum is, and who it is for.')),
          paragraph(
            text(
              `The agenda includes a ${FIXTURE.forum.onlyHereToken} session, a phrase that ` +
                'appears on this page and nowhere else on the site.',
            ),
          ),
        ),
        {
          blockType: 'eventDetails',
          facts: [
            { label: 'Date', value: 'This autumn' },
            { label: 'Venue', value: 'Northgate University' },
            { label: 'Audience', value: 'Industry partners' },
          ],
        },
        {
          // blockName becomes the block's id, so the sticky bar can send people
          // to #register without leaving the page.
          blockName: FIXTURE.forum.blockName,
          blockType: 'formBlock',
          form: registerForm.id,
          enableIntro: true,
          introContent: root(
            heading('h2', text('Register your interest')),
            paragraph(text('Places are limited. Tell us who you are.')),
          ),
        },
        {
          blockType: 'cta',
          richText: root(paragraph(text('Questions about the Forum?'))),
          links: [
            {
              link: { type: 'custom', appearance: 'outline', label: 'Contact us', url: '/contact' },
            },
          ],
        },
      ],
    },
    {
      slug: 'digit',
      _status: 'published',
      title: FIXTURE.umbrella.pageTitle,
      hero: {
        type: 'lowImpact',
        richText: root(heading('h1', text(FIXTURE.umbrella.pageTitle))),
      },
      layout: [
        passage(
          paragraph(text('The umbrella team, described without a single image on the page.')),
          bullets([text('It coordinates two workstreams.')], [text('It has no logos of its own.')]),
        ),
      ],
    },
    {
      slug: 'accessibility',
      _status: 'published',
      title: 'Accessibility statement',
      hero: { type: 'lowImpact', richText: root(heading('h1', text('Accessibility statement'))) },
      layout: [passage(paragraph(text('How accessible this fictional website is.')))],
    },
    {
      slug: 'privacy',
      _status: 'published',
      title: 'Privacy notice',
      hero: { type: 'lowImpact', richText: root(heading('h1', text('Privacy notice'))) },
      layout: [passage(paragraph(text('How this fictional programme handles personal data.')))],
    },
    {
      // Two pages the search tests need: one whose TITLE carries the token,
      // one whose BODY carries a different token and whose title does not.
      slug: 'title-match-page',
      _status: 'published',
      title: `A page whose title says ${FIXTURE.search.titleToken}`,
      hero: { type: 'lowImpact', richText: root(heading('h1', text('Title match'))) },
      layout: [passage(paragraph(text('Nothing unusual in this body.')))],
    },
    {
      slug: 'body-match-page',
      _status: 'published',
      title: 'A page with an ordinary title',
      hero: { type: 'lowImpact', richText: root(heading('h1', text('Body match'))) },
      layout: [
        passage(
          paragraph(
            text(`Buried in the middle of this page is the word ${FIXTURE.search.bodyToken}.`),
          ),
        ),
      ],
    },
  ]

  for (const data of pages) {
    await payload.create({ collection: 'pages', depth: 0, ...noRevalidate, data: data as never })
  }

  payload.logger.info('— Posts...')

  // Computed, never a literal: a hardcoded date stops being "upcoming" the day
  // after it passes, and the test that pins an event above the news would then
  // fail for a reason that has nothing to do with the code.
  const upcoming = new Date(
    Date.now() + FIXTURE.posts.event.daysAhead * 24 * 60 * 60 * 1000,
  ).toISOString()

  await payload.create({
    collection: 'posts',
    depth: 0,
    ...noRevalidate,
    data: {
      slug: FIXTURE.posts.news.slug,
      _status: 'published',
      title: FIXTURE.posts.news.title,
      heroImage: cardImage,
      categories: [newsCategory.id],
      publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      content: root(
        paragraph(text('The programme has published its first annual report.')),
        // A logo row inside an article: it must not render as a bulleted list.
        block({
          blockType: 'partnerLogos',
          blockName: 'With',
          heading: 'With',
          partners: [partnerId['harbour-data-trust'], partnerId['meridian-studies-network']],
        }),
        paragraph(text('A closing paragraph after the logo row.')),
      ),
      meta: { title: FIXTURE.posts.news.title, description: 'The first annual report.' },
    } as never,
  })

  await payload.create({
    collection: 'posts',
    depth: 0,
    ...noRevalidate,
    data: {
      slug: FIXTURE.posts.event.slug,
      _status: 'published',
      title: FIXTURE.posts.event.title,
      heroImage: cardImage,
      categories: [newsCategory.id],
      eventDate: upcoming,
      publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      content: root(paragraph(text('The Forum launch meeting, still to come.'))),
      meta: { title: FIXTURE.posts.event.title, description: 'The Forum launch meeting.' },
    } as never,
  })

  payload.logger.info('— Globals...')

  // The programme's own address. The footer and the "Programme email" inline
  // block both show it, so no page has to type it.
  await payload.updateGlobal({
    slug: 'programmeDetails',
    ...noRevalidate,
    data: { email: FIXTURE.contactEmail },
  })

  const navLinks = [
    FIXTURE.headerLink,
    { label: 'Workstreams', url: '/workstreams' },
    { label: 'For industry', url: '/industry' },
    { label: 'News', url: '/posts' },
    { label: 'Team', url: '/people' },
    { label: 'Contact', url: '/contact' },
  ]

  await payload.updateGlobal({
    slug: 'header',
    ...noRevalidate,
    data: {
      navItems: navLinks.map(({ label, url }) => ({
        link: { type: 'custom' as const, label, url },
      })),
    },
  })

  await payload.updateGlobal({
    slug: 'footer',
    ...noRevalidate,
    data: {
      navItems: [
        ...navLinks.map(({ label, url }) => ({
          link: { type: 'custom' as const, label, url },
        })),
        {
          link: {
            type: 'custom' as const,
            label: 'Industry Engagement Forum',
            url: '/industry-engagement-forum',
          },
        },
        { link: { type: 'custom' as const, label: 'The umbrella team', url: '/digit' } },
        {
          link: {
            type: 'custom' as const,
            newTab: true,
            label: 'An external link',
            url: 'https://example.org/external',
          },
        },
        // The two statements belong in the small print, not among the sections.
        {
          link: { type: 'custom' as const, label: 'Accessibility', url: '/accessibility' },
          smallPrint: true,
        },
        {
          link: { type: 'custom' as const, label: 'Privacy', url: '/privacy' },
          smallPrint: true,
        },
      ],
    },
  })

  payload.logger.info(
    `Fixture loaded: ${pages.length} pages, ${workstreams.length} workstreams, ` +
      `${people.length} people, ${partners.length} partners, 2 posts.`,
  )
  // Worth saying every time, because the symptom is so misleading: Next caches
  // the partner and global queries on disk, so a dev server started before this
  // ran will keep serving the previous content and the suite will fail against
  // data that is no longer in the database.
  payload.logger.info('If a dev server is running, stop it and `rm -rf .next` before testing.')

  process.exit(0)
}

load().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
