'use client'

import React, { useCallback, useEffect, useRef } from 'react'

import type { Person } from '@/payload-types'
import { Media } from '@/components/Media'
import { SIZE_PERSON_CARD } from '@/components/Media/sizes'
import { personAnchor } from '@/utilities/personAnchor'
import { workstreamTitles } from '@/utilities/people'
import { cn } from '@/utilities/ui'

const HONORIFICS = new Set([
  'prof',
  'prof.',
  'professor',
  'dr',
  'dr.',
  'sir',
  'dame',
  'mr',
  'ms',
  'mrs',
])

/** Initials for the no-portrait state, skipping honorifics. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((part) => part && !HONORIFICS.has(part.toLowerCase()))
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

/**
 * One person: portrait, name, role, workstream, institution — and, behind the
 * card itself, the biography in a dialog.
 *
 * The whole card is the trigger. There used to be a "Read more" line under
 * the text, and because a grid row is as tall as its tallest cell, that line
 * either sat pinned to the row's bottom — a long way below a short card's
 * last line — or followed the content and staggered across the row. Neither
 * was wrong; both were the geometry of uneven text in a grid. Removing the
 * line removes the thing that could be far from anything. The name is the
 * real control (one tab stop, a button with a dialog behind it, focus
 * restored to it on close); a click anywhere else on the card is forwarded
 * to that button, so the platform still does the accessibility.
 *
 * `<dialog>` brings the top layer, backdrop, Escape and focus trapping. It is
 * rendered from the first paint — a closed dialog is display:none — so the
 * biography is page content in the HTML rather than data behind a click.
 * Without JavaScript the name is plain text and the biography is not shown,
 * which is why the card still carries role, workstream and institution.
 */
export const PersonCard: React.FC<{ person: Person; index: number }> = ({ person, index }) => {
  const titles = workstreamTitles(person)
  const hasBio = Boolean(person.bio)

  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  // Set when the visitor dismisses with the mouse, so the focus the dialog
  // hands back does not arrive wearing a ring. See the `close` listener below.
  const dismissedByPointer = useRef(false)

  // Focus the name first, then open. `showModal` returns focus to whatever
  // was focused when it was called, and that has to be the name button — a
  // click on the portrait focuses nothing, and Safari does not focus buttons
  // on a mouse click either. Doing it here covers both paths the same way.
  const open = useCallback(() => {
    trigger.current?.focus({ preventScroll: true })
    dialog.current?.showModal()
  }, [])

  const close = useCallback(() => dialog.current?.close(), [])

  const closeByPointer = useCallback(() => {
    dismissedByPointer.current = true
    close()
  }, [close])

  const onCardClick = useCallback(
    (event: React.MouseEvent<HTMLLIElement>) => {
      const target = event.target as Element
      // The button handles itself; clicks inside the open dialog are its own.
      if (target.closest('button, a, dialog')) return
      // Dragging to select text is not a click.
      if (window.getSelection()?.toString()) return
      open()
    },
    [open],
  )

  // The backdrop is part of the dialog's own box, so a click that lands on
  // the dialog element itself is a click outside its content.
  const onDialogClick = useCallback(
    (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target === dialog.current) closeByPointer()
    },
    [closeByPointer],
  )

  // A dialog returns focus to its opener, which is right — but WebKit counts
  // that restored focus as keyboard focus even when the visitor closed the
  // thing with the mouse, so a ring appeared around a name nobody had tabbed
  // to. Chromium already distinguishes the two. Where the dismissal was a
  // pointer, the button is marked for one focus only and the mark is dropped
  // the moment a key is pressed or focus moves, so a visitor who reaches for
  // the keyboard next still sees exactly where they are.
  useEffect(() => {
    const node = dialog.current
    if (!node) return

    const onClose = () => {
      const button = trigger.current
      if (!button || !dismissedByPointer.current) {
        dismissedByPointer.current = false
        return
      }
      dismissedByPointer.current = false
      button.dataset.quietFocus = ''
      const clear = () => delete button.dataset.quietFocus
      button.addEventListener('blur', clear, { once: true })
      button.addEventListener('keydown', clear, { once: true })
    }

    node.addEventListener('close', onClose)
    return () => {
      node.removeEventListener('close', onClose)
      node.close()
    }
  }, [])

  return (
    <li
      className={cn('group flex scroll-mt-28 flex-col gap-3', hasBio && 'cursor-pointer')}
      data-reveal
      id={personAnchor(person.name)}
      onClick={hasBio ? onCardClick : undefined}
      style={{ transitionDelay: `${(index % 4) * 60}ms` }}
    >
      <div className="aspect-[4/5] w-full overflow-hidden bg-card">
        {person.photo && typeof person.photo === 'object' ? (
          <Media
            // Every layer between the 4/5 frame and the img must carry full
            // height — Media's wrapper div and the picture element — or
            // object-cover has no box to cover, and any non-4/5 photo
            // letterboxes on the card ground instead of cropping.
            className={cn(
              'block h-full w-full',
              hasBio &&
                'transition-transform duration-[var(--dur-reveal)] ease-[var(--ease-out)] group-hover:scale-[1.03]',
            )}
            imgClassName="h-full w-full object-cover"
            pictureClassName="block h-full w-full"
            resource={person.photo}
            size={SIZE_PERSON_CARD}
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-end p-4 font-display text-[2.6rem] leading-none text-muted-foreground/55"
          >
            {initials(person.name)}
          </div>
        )}
      </div>
      <div>
        <h3 className="font-display text-[1.2rem] leading-tight">
          {hasBio ? (
            <button
              aria-haspopup="dialog"
              className="text-left group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4"
              onClick={open}
              ref={trigger}
              type="button"
            >
              <span data-person-name>{person.name}</span>
              <span className="sr-only">, read biography</span>
            </button>
          ) : (
            <span data-person-name>{person.name}</span>
          )}
        </h3>
        <p className="mt-1 text-[1rem] font-medium leading-snug">{person.role}</p>
        {/* Which part of the programme someone works on comes before which
            institution employs them: this is a programme site, and the
            workstream is the thing a reader is here to follow. */}
        {titles.length > 0 && <p className="eyebrow mt-2">{titles.join(' · ')}</p>}
        <p className="mt-1.5 text-[0.95rem] leading-snug text-muted-foreground">
          {person.organisation}
        </p>
      </div>

      {hasBio && (
        <dialog
          aria-label={person.name}
          // Capped and scrollable: every biography fits a phone today, but a
          // longer one should scroll inside the dialog rather than run off it.
          className="m-auto max-h-[calc(100dvh-3rem)] w-[min(34rem,calc(100vw-2rem))] cursor-auto overflow-y-auto border border-border bg-background p-0 text-foreground backdrop:bg-foreground/40"
          onClick={onDialogClick}
          ref={dialog}
        >
          <div className="flex flex-col gap-4 p-6 lg:p-8">
            <div>
              <h2 className="font-display text-[1.45rem] leading-tight">{person.name}</h2>
              {person.role && (
                <p className="mt-1 text-[1rem] font-medium leading-snug">{person.role}</p>
              )}
              {titles.length > 0 && <p className="eyebrow mt-2">{titles.join(' · ')}</p>}
              {person.organisation && (
                <p className="mt-1.5 text-[0.95rem] leading-snug text-muted-foreground">
                  {person.organisation}
                </p>
              )}
            </div>
            <p className="text-[0.95rem] leading-relaxed text-muted-foreground">{person.bio}</p>
            <button
              className="mt-2 w-fit border border-border px-4 py-2 text-[0.95rem] font-medium transition-colors duration-[var(--dur-ui)] hover:bg-foreground/[0.04]"
              onClick={closeByPointer}
              type="button"
            >
              Close
            </button>
          </div>
        </dialog>
      )}
    </li>
  )
}
