'use client'

import React, { useCallback, useEffect, useRef } from 'react'

/**
 * A person's biography in a dialog rather than an expander on the card.
 *
 * Expanding in place left the grid ragged — some cards open, some closed, and
 * a tall gap beside every short one — because a grid row is as tall as its
 * tallest cell. A dialog keeps every card the same height whatever is open,
 * and one biography at a time is how someone actually reads them.
 *
 * `<dialog>` does the work: the top layer, the backdrop, Escape, focus trapping
 * and focus restoration are all the platform's. Without JavaScript the button
 * does nothing and the biography is simply not shown, which is why the card
 * still carries the person's role, workstream and institution as plain text.
 *
 * The dialog is in the document from the first paint rather than created on
 * demand: a closed `<dialog>` is display:none and costs nothing, and this way
 * the biographies are real page content — in the HTML, for a crawler or a
 * reader-mode — rather than data waiting behind a click.
 */
export const PersonDialog: React.FC<{
  name: string
  role?: string | null
  workstreams?: string[]
  organisation?: string | null
  bio: string
}> = ({ name, role, workstreams = [], organisation, bio }) => {
  const ref = useRef<HTMLDialogElement>(null)

  const open = useCallback(() => ref.current?.showModal(), [])

  // The backdrop is part of the dialog's own box, so a click lands on the
  // dialog itself — outside its content is a click on the backdrop.
  const onClick = useCallback((event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === ref.current) ref.current?.close()
  }, [])

  useEffect(() => {
    const dialog = ref.current
    return () => dialog?.close()
  }, [])

  return (
    <>
      <button
        className="eyebrow inline-flex w-fit cursor-pointer items-center gap-1.5 pt-1 text-muted-foreground transition-colors duration-[var(--dur-ui)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        onClick={open}
        type="button"
      >
        Read more
        <span aria-hidden="true">→</span>
        <span className="sr-only"> about {name}</span>
      </button>

      <dialog
        aria-label={name}
        // Capped and scrollable: every biography fits a phone today, but a
        // longer one should scroll inside the dialog rather than run off it.
        className="m-auto max-h-[calc(100dvh-3rem)] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto border border-border bg-background p-0 text-foreground backdrop:bg-foreground/40"
        onClick={onClick}
        ref={ref}
      >
        <div className="flex flex-col gap-4 p-6 lg:p-8">
          <div>
            <h2 className="font-display text-[1.45rem] leading-tight">{name}</h2>
            {role && <p className="mt-1 text-[1rem] font-medium leading-snug">{role}</p>}
            {workstreams.length > 0 && <p className="eyebrow mt-2">{workstreams.join(' · ')}</p>}
            {organisation && (
              <p className="mt-1.5 text-[0.95rem] leading-snug text-muted-foreground">
                {organisation}
              </p>
            )}
          </div>
          <p className="text-[0.95rem] leading-relaxed text-muted-foreground">{bio}</p>
          <button
            className="mt-2 w-fit border border-border px-4 py-2 text-[0.95rem] font-medium transition-colors duration-[var(--dur-ui)] hover:bg-foreground/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            onClick={() => ref.current?.close()}
            type="button"
          >
            Close
          </button>
        </div>
      </dialog>
    </>
  )
}
