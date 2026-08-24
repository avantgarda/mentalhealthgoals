import React, { Fragment } from 'react'

import type { Page } from '@/payload-types'

import { ArchiveBlock } from '@/blocks/ArchiveBlock/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import { ContentBlock } from '@/blocks/Content/Component'
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
  cta: 'my-20 lg:my-28',
  content: 'my-16 lg:my-24',
  workstreamsBlock: 'my-20 lg:my-28',
  peopleBlock: 'my-16 lg:my-24',
  eventDetails: 'my-16 lg:my-24',
}

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
              return (
                <div className={spacing[blockType] ?? 'my-16 lg:my-24'} key={index}>
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
