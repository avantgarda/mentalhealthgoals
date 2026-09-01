'use client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import React, { useState, useEffect, useRef } from 'react'
import { useDebounce } from '@/utilities/useDebounce'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * The search box. Typing updates `?q=` as you go, debounced.
 *
 * Two things it must not do, both of which it used to. It must start from the
 * query already in the URL — otherwise arriving at `/search?q=forum` from a
 * shared link, a bookmark or the back button immediately rewrote the URL to
 * `/search` and showed everything. And it must `replace` rather than `push`,
 * or every keystroke lands in the history stack and Back walks the visitor
 * letter by letter out of their own search.
 */
export const Search: React.FC = () => {
  const searchParams = useSearchParams()
  const queryFromUrl = searchParams.get('q') ?? ''

  const [value, setValue] = useState(queryFromUrl)
  const router = useRouter()

  const debouncedValue = useDebounce(value)
  // What the URL is expected to hold. Navigating only when the debounced value
  // has actually diverged keeps the mount pass from clobbering `?q=`.
  const lastSynced = useRef(queryFromUrl)

  useEffect(() => {
    if (debouncedValue === lastSynced.current) return
    lastSynced.current = debouncedValue
    router.replace(`/search${debouncedValue ? `?q=${encodeURIComponent(debouncedValue)}` : ''}`, {
      scroll: false,
    })
  }, [debouncedValue, router])

  return (
    <form
      className="relative"
      onSubmit={(e) => {
        e.preventDefault()
      }}
      role="search"
    >
      <Label className="eyebrow mb-2 block" htmlFor="search">
        Search the site
      </Label>
      <Input
        autoComplete="off"
        className="h-12 pr-24 text-base"
        id="search"
        onChange={(event) => {
          setValue(event.target.value)
        }}
        placeholder="Pages, workstreams, news, people"
        type="search"
        value={value}
      />
      {value && (
        <button
          className="absolute bottom-0 right-0 h-12 px-4 text-[0.8rem] font-medium text-muted-foreground underline decoration-1 underline-offset-4 transition-colors duration-[var(--dur-ui)] hover:text-foreground"
          onClick={() => setValue('')}
          type="button"
        >
          Clear
        </button>
      )}
    </form>
  )
}
