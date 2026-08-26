import React, { Fragment } from 'react'

import type { Page } from '@/payload-types'

import { ArchiveBlock } from '@/blocks/ArchiveBlock/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import { ContentBlock, isDoorsLayout } from '@/blocks/Content/Component'
import { EventDetailsBlockComponent } from '@/blocks/EventDetails/Component'
import { FormBlock } from '@/blocks/Form/Component'
import { MediaBlock } from '@/blocks/MediaBlock/Component'
import { PeopleBlockComponent } from '@/blocks/People/Component'
import { StatsBlockComponent } from '@/blocks/Stats/Component'
import { WorkstreamsBlockComponent } from '@/blocks/Workstreams/Component'

const blockComponents = {
  archive: ArchiveBlock,
  content: ContentBlock,
  cta: CallToActionBlock,
  eventDetails: EventDetailsBlockComponent,
  formBlock: FormBlock,
  mediaBlock: MediaBlock,
  peopleBlock: PeopleBlockComponent,
  stats: StatsBlockComponent,
  workstreamsBlock: WorkstreamsBlockComponent,
}

/** Vertical rhythm: a statement block gets more air than a list that follows a list. */
const spacing: Partial<Record<keyof typeof blockComponents, string>> = {
  stats: 'my-14 lg:my-20',
  // Full-bleed band: no outer margin, so it abuts its neighbours instead of
  // sitting in a stark white gap.
  cta: 'mt-16 lg:mt-24',
  content: 'my-16 lg:my-24',
  workstreamsBlock: 'my-20 lg:my-28',
  peopleBlock: 'my-16 lg:my-24',
  eventDetails: 'my-16 lg:my-24',
}

/** Blocks that paint their own full-width ground. */
const isFullBleed = (block: Page['layout'][0]): boolean =>
  block.blockType === 'cta' || (block.blockType === 'content' && isDoorsLayout(block))

export const RenderBlocks: React.FC<{
  blocks: Page['layout'][0][]
}> = (props) => {
  const { blocks } = props

  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0

  if (hasBlocks) {
    return (
      <Fragment>
        {blocks.map((block, index) => {
          const { blockType } = block

          if (blockType && blockType in blockComponents) {
            const Block = blockComponents[blockType]

            if (Block) {
              // Full-bleed bands (the audience doors, the CTA) sit flush against
              // each other and against the footer — a white gutter between two
              // coloured bands reads as a mistake rather than as breathing room.
              const isBand = isFullBleed(block)
              const followsBand = Boolean(blocks[index - 1] && isFullBleed(blocks[index - 1]))
              const precedesBand = Boolean(blocks[index + 1] && isFullBleed(blocks[index + 1]))
              const isLast = index === blocks.length - 1

              const margin = [
                spacing[blockType] ?? 'my-16 lg:my-24',
                // adjacent bands meet with no gutter between them
                isBand && followsBand ? '!mt-0' : '',
                isBand && precedesBand ? '!mb-0' : '',
                // a closing band meets the footer: cancels the article's pb-24
                isBand && isLast ? '!-mb-24' : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <div className={margin} data-first-block={index === 0 ? '' : undefined} key={index}>
                  {/* @ts-expect-error there may be some mismatch between the expected types here */}
                  <Block {...block} disableInnerContainer />
                </div>
              )
            }
          }
          return null
        })}
      </Fragment>
    )
  }

  return null
}
