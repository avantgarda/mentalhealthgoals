import React from 'react'

import { Card } from '@/components/Card'
import type { UpcomingEvent } from '@/utilities/events'

/**
 * Events still to come, pinned above the chronological news list.
 *
 * The band exists to answer one question at a glance — is anything on? — so
 * it renders nothing at all when nothing is coming up, and the listing below
 * reads exactly as it would have. Its own ground (the same card ground the
 * page "doors" use) is what separates it from the news rows; the accent is
 * spent on the dates, which are the fact a reader is scanning for.
 */
export const UpcomingEvents: React.FC<{ events: UpcomingEvent[] }> = ({ events }) => {
  if (events.length === 0) return null

  return (
    <section aria-labelledby="coming-up" className="bg-card">
      <div className="container py-12 lg:py-14">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="display-2" id="coming-up">
            Coming up
          </h2>
          <p className="eyebrow">{events.length === 1 ? '1 event' : `${events.length} events`}</p>
        </div>
        {/* The ground is the boundary. A heavy rule inside it drew a second
            one a few pixels later, and a container-width rule against a
            full-bleed colour visibly stops short of it — so the rows take the
            same hairline the "doors" band uses. */}
        <div className="border-t border-foreground/25">
          {events.map((event) => (
            <Card doc={event} key={event.id} relationTo="posts" variant="event" />
          ))}
        </div>
      </div>
    </section>
  )
}
