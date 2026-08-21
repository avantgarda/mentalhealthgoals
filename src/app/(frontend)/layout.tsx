import type { Metadata } from 'next'

import { cn } from '@/utilities/ui'
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from 'next/font/google'
import React from 'react'

import { AdminBar } from '@/components/AdminBar'
import { brandAssetPath, getBrandSettings } from '@/brand/getBrand'
import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { Providers } from '@/providers'
import { InitMotion } from '@/providers/Motion/InitMotion'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { RevealObserver } from '@/components/Reveal/RevealObserver'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { draftMode } from 'next/headers'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'

/** Body and UI face — a humanist grotesque with a technical edge. */
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-plex-sans',
  display: 'swap',
})

/** Labels, times and data. */
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
})

/** Display serif with an optical-size axis — crisp at headline sizes, sturdy small. */
const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-newsreader',
  display: 'swap',
})

/** The wordmark face — kept for the brand lockup only. */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()
  const brand = await getBrandSettings()

  return (
    <html
      className={cn(plexSans.variable, plexMono.variable, newsreader.variable, fraunces.variable)}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <InitTheme />
        <InitMotion />
        <link
          href={brandAssetPath(brand.variant, 'favicon-32.png')}
          rel="icon"
          sizes="32x32"
          type="image/png"
        />
        <link href={brandAssetPath(brand.variant, 'favicon.svg')} rel="icon" type="image/svg+xml" />
        <link
          href={brandAssetPath(brand.variant, 'apple-touch-icon.png')}
          rel="apple-touch-icon"
          sizes="180x180"
        />
      </head>
      <body>
        <nav aria-label="Skip link">
          <a
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:outline-2 focus:outline-ring"
            href="#main-content"
          >
            Skip to main content
          </a>
        </nav>
        <Providers>
          <AdminBar
            adminBarProps={{
              preview: isEnabled,
            }}
          />

          <Header />
          <main className="focus:outline-none" id="main-content" tabIndex={-1}>
            {children}
          </main>
          <Footer />
          <RevealObserver />
        </Providers>
      </body>
    </html>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandSettings()

  return {
    metadataBase: new URL(getServerSideURL()),
    openGraph: mergeOpenGraph({
      images: [
        {
          url: `${getServerSideURL()}${brandAssetPath(brand.variant, 'og.png')}`,
          width: 1200,
          height: 630,
        },
      ],
    }),
    title: {
      default: 'Mental Health Goals Programme',
      template: '%s',
    },
    description:
      'A UK Government-backed national programme transforming mental health research — connecting industry, researchers, patients and the public.',
    twitter: {
      card: 'summary_large_image',
    },
  }
}
