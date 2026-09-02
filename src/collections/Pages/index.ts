import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { authenticatedOrPublished } from '../../access/authenticatedOrPublished'
import { Archive } from '../../blocks/ArchiveBlock/config'
import { CallToAction } from '../../blocks/CallToAction/config'
import { Content } from '../../blocks/Content/config'
import { EventDetails } from '../../blocks/EventDetails/config'
import { FormBlock } from '../../blocks/Form/config'
import { MediaBlock } from '../../blocks/MediaBlock/config'
import { PeopleBlock } from '../../blocks/People/config'
import { PartnerLogos } from '../../blocks/PartnerLogos/config'
import { Stats } from '../../blocks/Stats/config'
import { WorkstreamsBlock } from '../../blocks/Workstreams/config'
import { hero } from '@/heros/config'
import { slugField } from 'payload'
import { populatePublishedAt } from '../../hooks/populatePublishedAt'
import { generatePreviewPath } from '../../utilities/generatePreviewPath'
import { revalidateDelete, revalidatePage } from './hooks/revalidatePage'

import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'

/** What the sticky CTA's own validators can see of their group. */
type StickyCtaSiblings = { siblingData?: { enabled?: boolean | null } }

export const Pages: CollectionConfig<'pages'> = {
  slug: 'pages',
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  // This config controls what's populated by default when a page is referenced
  // https://payloadcms.com/docs/queries/select#defaultpopulate-collection-config-property
  // Type safe if the collection slug generic is passed to `CollectionConfig` - `CollectionConfig<'pages'>
  defaultPopulate: {
    title: true,
    slug: true,
  },
  admin: {
    defaultColumns: ['title', 'slug', 'updatedAt'],
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: 'pages',
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: 'pages',
        req,
      }),
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [hero],
          label: 'Hero',
        },
        {
          fields: [
            {
              name: 'layout',
              type: 'blocks',
              blocks: [
                CallToAction,
                Content,
                MediaBlock,
                Archive,
                FormBlock,
                Stats,
                WorkstreamsBlock,
                PeopleBlock,
                EventDetails,
                PartnerLogos,
              ],
              required: true,
              admin: {
                initCollapsed: true,
              },
            },
          ],
          label: 'Content',
        },
        {
          name: 'meta',
          label: 'SEO',
          fields: [
            OverviewField({
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
              imagePath: 'meta.image',
            }),
            MetaTitleField({
              hasGenerateFn: true,
            }),
            MetaImageField({
              relationTo: 'media',
            }),

            MetaDescriptionField({}),
            PreviewField({
              // if the `generateUrl` function is configured
              hasGenerateFn: true,

              // field paths to match the target field for data
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
            }),
          ],
        },
      ],
    },
    {
      name: 'stickyCta',
      type: 'group',
      label: 'Sticky call to action',
      admin: {
        position: 'sidebar',
        description:
          'A bar that follows the visitor down a long page. It appears once the hero has scrolled past, steps aside when the page reaches its own closing call to action, and can be dismissed.',
      },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Show the sticky bar',
        },
        {
          name: 'message',
          type: 'text',
          label: 'Message',
          admin: {
            condition: (_, siblingData) => Boolean(siblingData?.enabled),
            description: 'One short line — a date and a place, not a sentence.',
          },
        },
        {
          name: 'label',
          type: 'text',
          label: 'Button text',
          admin: {
            condition: (_, siblingData) => Boolean(siblingData?.enabled),
          },
          // Not `required`, which would apply whether the bar is on or off and
          // block every page from saving. Enforced only once it is switched on.
          validate: (value: string | null | undefined, { siblingData }: StickyCtaSiblings) =>
            siblingData?.enabled && !value
              ? 'Add the button text, or switch the sticky bar off.'
              : true,
        },
        {
          name: 'href',
          type: 'text',
          label: 'Links to',
          admin: {
            condition: (_, siblingData) => Boolean(siblingData?.enabled),
            description:
              'A path such as /contact, or an anchor such as #register — name a block in the Content tab to create one.',
          },
          validate: (value: string | null | undefined, { siblingData }: StickyCtaSiblings) =>
            siblingData?.enabled && !value
              ? 'Add where the button goes, or switch the sticky bar off.'
              : true,
        },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
      },
    },
    slugField(),
  ],
  hooks: {
    afterChange: [revalidatePage],
    beforeChange: [populatePublishedAt],
    afterDelete: [revalidateDelete],
  },
  versions: {
    drafts: {
      autosave: {
        interval: 100, // We set this interval for optimal live preview
      },
      // schedulePublish is off: on Vercel nothing runs the jobs queue, so
      // scheduled publishes would silently never fire. To enable it, add a
      // vercel.json cron hitting /api/payload-jobs/run (Pro plan for
      // minute-level schedules) and turn this back on.
      schedulePublish: false,
    },
    maxPerDoc: 50,
  },
}
