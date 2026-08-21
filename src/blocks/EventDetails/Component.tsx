import React from 'react'

import type { EventDetailsBlock as EventDetailsBlockProps } from '@/payload-types'

/** Facts as a rule-row, the agenda as a timetable, outputs as ruled rows. */
export const EventDetailsBlockComponent: React.FC<EventDetailsBlockProps> = ({
  facts,
  agendaHeading,
  agenda,
  outcomesHeading,
  outcomes,
}) => {
  return (
    <div className="container flex flex-col gap-16">
      {facts && facts.length > 0 && (
        <dl
          className="grid grid-cols-1 border-y border-border sm:grid-cols-2 lg:grid-cols-4"
          data-reveal
        >
          {facts.map((fact, i) => (
            <div
              className="flex flex-col gap-1.5 py-5 sm:pr-6 lg:border-r lg:border-border lg:last:border-r-0 lg:[&:not(:first-child)]:pl-6"
              key={i}
            >
              <dt className="eyebrow">{fact.label}</dt>
              <dd className="text-[0.95rem] leading-snug">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {agenda && agenda.length > 0 && (
        <div className="grid grid-cols-1 gap-y-6 lg:grid-cols-12 lg:gap-x-10">
          <div className="lg:col-span-3">
            {agendaHeading && (
              <h2 className="display-2 lg:sticky lg:top-8" data-reveal>
                {agendaHeading}
              </h2>
            )}
          </div>
          <ol className="border-t border-border lg:col-span-8 lg:col-start-5" data-reveal>
            {agenda.map((row, i) => (
              <li
                className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 border-b border-border py-3.5"
                key={i}
              >
                <span className="pt-[0.2rem] font-mono text-[0.8rem] tabular-nums text-brand-accent-text">
                  {row.time || ''}
                </span>
                <span
                  className={
                    row.time
                      ? 'text-[0.98rem] leading-relaxed'
                      : 'text-[0.95rem] leading-relaxed text-muted-foreground'
                  }
                >
                  {row.item}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {outcomes && outcomes.length > 0 && (
        <div className="grid grid-cols-1 gap-y-6 lg:grid-cols-12 lg:gap-x-10">
          <div className="lg:col-span-3">
            {outcomesHeading && (
              <h2 className="display-2 lg:sticky lg:top-8" data-reveal>
                {outcomesHeading}
              </h2>
            )}
          </div>
          <ul className="border-t border-border lg:col-span-8 lg:col-start-5">
            {outcomes.map((outcome, i) => (
              <li
                className="grid grid-cols-1 gap-2 border-b border-border py-6 md:grid-cols-12 md:gap-x-8"
                data-reveal
                key={i}
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <h3 className="display-3 md:col-span-5">{outcome.title}</h3>
                {outcome.description && (
                  <p className="text-[0.95rem] leading-relaxed text-muted-foreground md:col-span-7">
                    {outcome.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
