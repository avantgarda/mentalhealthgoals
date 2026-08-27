import Link from 'next/link'
import React from 'react'

import { Button } from '@/components/ui/button'
import { Ridge } from '@/components/Ridge/Ridge'

export default function NotFound() {
  return (
    <div className="container pb-28 pt-16 lg:pt-24">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-x-10">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <p className="eyebrow">Error</p>
          <h1 className="display-1">404</h1>
          <p className="lede max-w-[34rem]">
            This page could not be found. It may have moved, or the address may be mistyped.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="default">
              <Link href="/">Go to the home page</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/search">Search the site</Link>
            </Button>
          </div>
        </div>
        <div aria-hidden="true" className="text-foreground/70 lg:col-span-5">
          <Ridge className="h-auto w-full" goal={false} lines={16} />
        </div>
      </div>
    </div>
  )
}
