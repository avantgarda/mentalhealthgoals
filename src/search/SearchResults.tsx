import React from 'react'

import type { Search } from '@/payload-types'

import { Card, type CardPostData } from '@/components/Card'
import { resultLabel } from './resultTypes'

/**
 * Search results as ruled rows, the same shape the news listing uses — with
 * the kind of result in place of the category, and the path resolved at index
 * time so this does not have to know one collection from another.
 */
export const SearchResults: React.FC<{ docs: Search[] }> = ({ docs }) => (
  <div className="container">
    <div className="border-t-2 border-foreground">
      {docs.map((doc) => (
        <Card
          doc={doc as unknown as CardPostData}
          eyebrow={resultLabel(doc.type)}
          href={doc.path || '/'}
          key={doc.id}
          title={doc.title ?? undefined}
        />
      ))}
    </div>
  </div>
)
