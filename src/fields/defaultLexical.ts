import type {
  FieldAffectingData,
  PolymorphicRelationshipField,
  TextFieldSingleValidation,
} from 'payload'
import {
  BoldFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  lexicalEditor,
  UnderlineFeature,
  UnorderedListFeature,
  type LinkFields,
} from '@payloadcms/richtext-lexical'

export const defaultLexical = lexicalEditor({
  features: [
    ParagraphFeature(),
    UnderlineFeature(),
    BoldFeature(),
    ItalicFeature(),
    // Without the list features registered, the admin editor cannot load
    // content containing list nodes at all — it crashes with Lexical's
    // "type not registered" error (seen on the seeded legal pages, which
    // use bulleted lists). The frontend renderer knows lists regardless.
    UnorderedListFeature(),
    OrderedListFeature(),
    // `media` lets an editor link text to an uploaded PDF from the picker (or
    // upload one in place) instead of typing `/api/media/file/...`. The site
    // adds the file type and size to the link text — see `MediaLink`.
    LinkFeature({
      enabledCollections: ['pages', 'posts', 'media'],
      fields: ({ defaultFields }) => {
        const linkFields = defaultFields.flatMap((field): FieldAffectingData[] => {
          if ('name' in field && field.name === 'url') return []
          if ('name' in field && field.name === 'doc') {
            // Payload's picker: one relationship across every enabled collection.
            const doc = field as PolymorphicRelationshipField
            const picker: PolymorphicRelationshipField = {
              ...doc,
              admin: {
                ...doc.admin,
                // Newest first: the file just uploaded for this link is on top.
                sortOptions: { media: '-createdAt' },
              },
              // Images are placed with the Media block, not linked to as text.
              filterOptions: ({ relationTo }) =>
                relationTo === 'media' ? { mimeType: { equals: 'application/pdf' } } : true,
            }
            return [picker]
          }
          return [field]
        })

        return [
          ...linkFields,
          {
            name: 'url',
            type: 'text',
            admin: {
              condition: (_data, siblingData) => siblingData?.linkType !== 'internal',
            },
            label: ({ t }) => t('fields:enterURL'),
            required: true,
            validate: ((value, options) => {
              if ((options?.siblingData as LinkFields)?.linkType === 'internal') {
                return true // no validation needed, as no url should exist for internal links
              }
              return value ? true : 'URL is required'
            }) as TextFieldSingleValidation,
          },
        ]
      },
    }),
  ],
})
