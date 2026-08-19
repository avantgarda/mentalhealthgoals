import React from 'react'

import type { EventDetailsBlock as EventDetailsBlockProps } from '@/payload-types'

export const EventDetailsBlockComponent: React.FC<EventDetailsBlockProps> = ({
  facts,
  agendaHeading,
  agenda,
  outcomesHeading,
  outcomes,
}) => {
  return (
    <div className="container flex flex-col gap-14">
      {facts && facts.length > 0 && (
        <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact, i) => (
            <div key={i} className="bg-card px-6 py-5">
              <dt className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
                {fact.label}
              </dt>
              <dd className="text-sm font-medium leading-snug">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {agenda && agenda.length > 0 && (
        <div>
          {agendaHeading && (
            <h2 className="text-2xl md:text-3xl font-semibold mb-6">{agendaHeading}</h2>
          )}
          <div className="flex flex-col divide-y divide-border border-y border-border">
            {agenda.map((row, i) => (
              <div key={i} className="py-4 flex gap-6 items-baseline">
                {row.time && (
                  <span className="font-mono text-sm text-brand-accent-text shrink-0 w-14">
                    {row.time}
                  </span>
                )}
                <span className="text-sm md:text-base leading-relaxed">{row.item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {outcomes && outcomes.length > 0 && (
        <div>
          {outcomesHeading && (
            <h2 className="text-2xl md:text-3xl font-semibold mb-6">{outcomesHeading}</h2>
          )}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {outcomes.map((outcome, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card p-6 flex flex-col gap-2"
              >
                <span className="font-display text-xl text-brand-accent-text">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="text-base font-semibold leading-snug">{outcome.title}</h3>
                {outcome.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {outcome.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
