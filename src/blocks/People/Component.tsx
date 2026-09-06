import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import type { PeopleBlockType } from '@/payload-types'
import { SectionHead } from '@/components/SectionHead'
import { PersonCard } from './PersonCard'
import { sortPeople } from '@/utilities/people'

/** Sections of the team, in the order they appear on the page. */
const GROUPS = [
  {
    value: 'leadership',
    heading: 'Programme leadership',
    intro:
      'Setting the strategic direction of the programme and representing it across the UK and internationally.',
  },
  {
    value: 'workstream-leads',
    heading: 'Workstream leads',
    intro: 'The leads of the six workstreams, from partner institutions across the UK.',
  },
  {
    value: 'delivery',
    heading: 'Delivery team',
    intro: 'The people industry and partners work with day to day.',
  },
] as const

/** The team, in sections: programme leadership, workstream leads, delivery team. */
export const PeopleBlockComponent: React.FC<PeopleBlockType> = async ({ heading, intro }) => {
  const payload = await getPayload({ config: configPromise })

  const people = await payload.find({
    collection: 'people',
    depth: 1,
    limit: 60,
    pagination: false,
  })

  const docs = people.docs

  if (docs.length === 0) return null

  const firstPopulated = GROUPS.find((group) =>
    docs.some((person) => person.group === group.value),
  )?.value

  return (
    <div className="container flex flex-col gap-16 lg:gap-20">
      {(heading || intro) && <SectionHead heading={heading} intro={intro} />}

      {GROUPS.map((group) => {
        const members = sortPeople(docs.filter((person) => person.group === group.value))
        if (members.length === 0) return null

        // The first section sits right under the page-frame rule, so it does
        // not draw a second one.
        const isFirst = !heading && !intro && group.value === firstPopulated

        return (
          <section key={group.value}>
            <SectionHead flush={isFirst} heading={group.heading} intro={group.intro} />
            {/* Smaller plates at the wide end: five and six across rather than
                four, so a face is a face and not a poster. */}
            <ul className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-8 xl:grid-cols-5 2xl:grid-cols-6">
              {members.map((person, index) => (
                <PersonCard index={index} key={person.id} person={person} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
