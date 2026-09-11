import { MediaBlock } from '@/blocks/MediaBlock/Component'
import {
  DefaultNodeTypes,
  SerializedBlockNode,
  SerializedInlineBlockNode,
  SerializedLinkNode,
  type DefaultTypedEditorState,
} from '@payloadcms/richtext-lexical'
import {
  JSXConvertersFunction,
  LinkJSXConverter,
  RichText as ConvertRichText,
} from '@payloadcms/richtext-lexical/react'

import { CodeBlock, CodeBlockProps } from '@/blocks/Code/Component'

import type {
  BannerBlock as BannerBlockProps,
  CallToActionBlock as CTABlockProps,
  MediaBlock as MediaBlockProps,
  PartnerLogosBlock as PartnerLogosBlockProps,
  ProgrammeEmailInlineBlock as ProgrammeEmailInlineBlockProps,
} from '@/payload-types'
import { BannerBlock } from '@/blocks/Banner/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import { PartnerLogosBlockComponent } from '@/blocks/PartnerLogos/Component'
import { cn } from '@/utilities/ui'

type NodeTypes =
  | DefaultNodeTypes
  | SerializedBlockNode<
      CTABlockProps | MediaBlockProps | BannerBlockProps | CodeBlockProps | PartnerLogosBlockProps
    >
  | SerializedInlineBlockNode<ProgrammeEmailInlineBlockProps>

const internalDocToHref = ({ linkNode }: { linkNode: SerializedLinkNode }) => {
  const { value, relationTo } = linkNode.fields.doc!
  if (typeof value !== 'object') {
    throw new Error('Expected value to be an object')
  }
  const slug = value.slug
  return relationTo === 'posts' ? `/posts/${slug}` : `/${slug}`
}

const jsxConverters: JSXConvertersFunction<NodeTypes> = ({ defaultConverters }) => ({
  ...defaultConverters,
  ...LinkJSXConverter({ internalDocToHref }),
  blocks: {
    banner: ({ node }) => <BannerBlock className="col-start-2 mb-4" {...node.fields} />,
    mediaBlock: ({ node }) => (
      <MediaBlock
        className="col-start-1 col-span-3"
        imgClassName="m-0"
        {...node.fields}
        captionClassName="mx-auto max-w-[48rem]"
        enableGutter={false}
        disableInnerContainer={true}
      />
    ),
    code: ({ node }) => <CodeBlock className="col-start-2" {...node.fields} />,
    cta: ({ node }) => <CallToActionBlock {...node.fields} />,
    partnerLogos: ({ node }) => (
      <PartnerLogosBlockComponent className="col-start-2" inline {...node.fields} />
    ),
  },
})

type Props = {
  data: DefaultTypedEditorState
  enableGutter?: boolean
  enableProse?: boolean
  /**
   * The address the "Programme email" inline block shows. This component also
   * renders in the browser (forms, the high-impact hero), so it cannot read
   * Programme details itself: a server parent reads it and passes it down.
   * Without it, the block renders nothing.
   */
  programmeEmail?: string | null
} & React.HTMLAttributes<HTMLDivElement>

export default function RichText(props: Props) {
  const { className, enableProse = true, enableGutter = true, programmeEmail, ...rest } = props

  const converters: JSXConvertersFunction<NodeTypes> = (args) => ({
    ...jsxConverters(args),
    inlineBlocks: {
      programmeEmail: () =>
        programmeEmail ? <a href={`mailto:${programmeEmail}`}>{programmeEmail}</a> : null,
    },
  })

  return (
    <ConvertRichText
      converters={converters}
      className={cn(
        'payload-richtext',
        {
          container: enableGutter,
          'max-w-none': !enableGutter,
          'mx-auto prose md:prose-md dark:prose-invert': enableProse,
        },
        className,
      )}
      {...rest}
    />
  )
}
