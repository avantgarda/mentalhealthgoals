import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import type { PeopleBlockType } from '@/payload-types'
import { Media } from '@/components/Media'

export const PeopleBlockComponent: React.FC<PeopleBlockType> = async ({ heading, intro }) => {
  const payload = await getPayload({ config: configPromise })

  const people = await payload.find({
    collection: 'people',
    depth: 1,
    limit: 24,
    pagination: false,
    sort: 'order',
  })

  const docs = people.docs

  if (docs.length === 0) return null

  return (
    <div className="container">
      {(heading || intro) && (
        <div className="max-w-2xl mb-10">
          {heading && <h2 className="text-3xl md:text-4xl font-semibold mb-3">{heading}</h2>}
          {intro && <p className="text-muted-foreground text-lg leading-relaxed">{intro}</p>}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {docs.map((person) => (
          <div
            key={person.id}
            className="rounded-xl border border-border bg-card p-7 flex flex-col gap-3"
          >
            {person.photo && typeof person.photo === 'object' && (
              <div className="w-20 h-20 rounded-full overflow-hidden mb-2">
                <Media imgClassName="object-cover w-full h-full" resource={person.photo} />
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold">{person.name}</h3>
              <p className="text-sm text-brand-accent-text font-medium mt-0.5">{person.role}</p>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
                {person.organisation}
              </p>
            </div>
            {person.bio && (
              <p className="text-sm text-muted-foreground leading-relaxed">{person.bio}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
