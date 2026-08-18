import type { Metadata } from 'next'

import { cn } from '@/utilities/ui'
import { Fraunces, Inter } from 'next/font/google'
import React from 'react'

import { AdminBar } from '@/components/AdminBar'
import { brandAssetPath, getBrandSettings } from '@/brand/getBrand'
import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { draftMode } from 'next/headers'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()
  const brand = await getBrandSettings()

  return (
    <html className={cn(inter.variable, fraunces.variable)} lang="en" suppressHydrationWarning>
      <head>
        <InitTheme />
        <link
          href={brandAssetPath(brand.variant, 'favicon-32.png')}
          rel="icon"
          sizes="32x32"
          type="image/png"
        />
        <link
          href={brandAssetPath(brand.variant, 'favicon.svg')}
          rel="icon"
          type="image/svg+xml"
        />
        <link
          href={brandAssetPath(brand.variant, 'apple-touch-icon.png')}
          rel="apple-touch-icon"
          sizes="180x180"
        />
      </head>
      <body>
        <Providers>
          <AdminBar
            adminBarProps={{
              preview: isEnabled,
            }}
          />

          <Header />
          {children}
          <Footer />
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
