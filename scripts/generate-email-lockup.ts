#!/usr/bin/env tsx
/**
 * generate-email-lockup.ts — the site's own header lockup, as a PNG for email.
 *
 * Mail clients render no SVG and load no web fonts, so the header of every
 * email is an image. It used to be rasterised from the lockup SVG, which meant
 * fallback type wherever Fraunces and Plex were not installed, and a
 * composition of its own. This instead renders the real `Logo` component with
 * the site's compiled stylesheet and fonts in a headless Chromium at 2x, and
 * photographs it — the email header is then the website header, to the pixel.
 *
 * Needs the site running (SITE_URL, default http://localhost:3210) to serve
 * the stylesheet and the font files next/font has fetched. Every variant is
 * written to public/brand/<variant>/lockup-email.png on the same canvas,
 * left-aligned, so the template's width and height attributes hold whichever
 * mark the CMS has chosen.
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { chromium } from '@playwright/test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'

import { MARKS, type LogoVariant } from '../src/brand/marks'
import { Logo } from '../src/components/Logo/Logo'
import { EMAIL_LOCKUP } from '../src/utilities/emailTemplate'

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3210'
const SCALE = 2

/**
 * Playwright's own Chromium — or, when that exact build is not installed, the
 * newest Chromium build already in Playwright's cache, which renders type
 * identically and saves a download after every Playwright bump.
 * `pnpm exec playwright install chromium` is the proper fix; local e2e needs
 * it anyway.
 */
async function launch() {
  try {
    return await chromium.launch()
  } catch (error) {
    const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright')
    const builds = existsSync(cache)
      ? readdirSync(cache)
          .filter((d) => /^chromium-\d+$/.test(d))
          .sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)))
      : []
    for (const build of builds) {
      const executablePath = path.join(
        cache,
        build,
        'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
      )
      if (existsSync(executablePath)) {
        console.warn(`Playwright's Chromium is not installed; using cached ${build}.`)
        return await chromium.launch({ executablePath })
      }
    }
    throw error
  }
}

async function main(): Promise<void> {
  const browser = await launch()
  try {
    const context = await browser.newContext({
      deviceScaleFactor: SCALE,
      viewport: { width: 800, height: 200 },
      colorScheme: 'light',
    })
    const page = await context.newPage()

    // Borrow the site's stylesheet links and the <html> classes that carry
    // next/font's font-family variables.
    await page.goto(`${SITE_URL}/contact`, { waitUntil: 'networkidle' })
    const { htmlClass, styles, theme } = await page.evaluate(() => ({
      htmlClass: document.documentElement.className,
      styles: [...document.querySelectorAll('link[rel="stylesheet"]')].map(
        (link: Element) => (link as HTMLLinkElement).href,
      ),
      theme: document.documentElement.getAttribute('data-theme'),
    }))
    if (styles.length === 0) throw new Error(`No stylesheet found at ${SITE_URL}/contact`)

    const canvas = { width: EMAIL_LOCKUP.width * SCALE, height: EMAIL_LOCKUP.height * SCALE }
    const sizes: Record<string, { width: number; height: number }> = {}

    for (const variant of Object.keys(MARKS) as LogoVariant[]) {
      const markup = renderToStaticMarkup(
        React.createElement(Logo, { variant, showTagline: true, className: 'inline-flex' }),
      )
      await page.setContent(
        `<!doctype html><html class="${htmlClass}"${theme ? ` data-theme="${theme}"` : ''}><head>${styles
          .map((href) => `<link rel="stylesheet" href="${href}">`)
          .join('')}</head>` +
          `<body class="text-foreground" style="margin:0;padding:8px;background:transparent;">` +
          `<div id="lockup" style="display:inline-block;">${markup}</div></body></html>`,
        { waitUntil: 'networkidle' },
      )
      // Playwright's transparent default only shows where nothing paints; the
      // site's stylesheet paints html and body, so those go clear too.
      await page.addStyleTag({
        content: 'html, body { background: transparent !important; }',
      })
      await page.evaluate(() => document.fonts.ready)
      if (process.env.DEBUG_LOCKUP) {
        await page.screenshot({ path: `temp/lockup-debug-${variant}.png` })
        console.log(
          await page.evaluate(() => {
            const word = document.querySelector('#lockup span span span') as HTMLElement
            const svg = document.querySelector('#lockup svg') as SVGElement
            return `theme=${document.documentElement.getAttribute('data-theme')} wordmark color=${getComputedStyle(word).color} font=${getComputedStyle(word).fontFamily.slice(0, 40)} svg color=${getComputedStyle(svg).color} html bg=${getComputedStyle(document.documentElement).backgroundColor} body bg=${getComputedStyle(document.body).backgroundColor}`
          }),
        )
        console.log(
          await page.evaluate(() =>
            ['#lockup', '#lockup > span', '#lockup svg', '#lockup span span'].map((sel) => {
              const el = document.querySelector(sel) as HTMLElement | null
              const b = el?.getBoundingClientRect()
              return `${sel}: ${b ? `${b.width.toFixed(1)}x${b.height.toFixed(1)} @${b.left.toFixed(1)},${b.top.toFixed(1)}` : 'missing'} display=${el ? getComputedStyle(el).display : '-'} font=${el ? getComputedStyle(el).fontFamily.split(',')[0] : '-'}`
            }),
          ),
        )
      }

      // The lockup's own root, not the wrapper: a wrapper is sized by the line
      // it sits on, the lockup by its contents.
      const shot = await page
        .locator('#lockup > span')
        .screenshot({ omitBackground: true, type: 'png' })
      const meta = await sharp(shot).metadata()
      const width = meta.width ?? 0
      const height = meta.height ?? 0
      sizes[variant] = { width: width / SCALE, height: height / SCALE }
      if (width > canvas.width || height > canvas.height) {
        throw new Error(
          `${variant} renders at ${width / SCALE}x${height / SCALE} CSS px, larger than EMAIL_LOCKUP ` +
            `(${EMAIL_LOCKUP.width}x${EMAIL_LOCKUP.height}). Raise EMAIL_LOCKUP in emailTemplate.ts.`,
        )
      }

      const dir = path.resolve('public/brand', variant)
      mkdirSync(dir, { recursive: true })
      await sharp(shot)
        .extend({
          top: 0,
          left: 0,
          bottom: canvas.height - height,
          right: canvas.width - width,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9 })
        .toFile(path.join(dir, 'lockup-email.png'))
      console.log(
        `✓ ${variant}: ${width / SCALE}x${height / SCALE} on ${EMAIL_LOCKUP.width}x${EMAIL_LOCKUP.height}`,
      )
    }
    const widest = Math.max(...Object.values(sizes).map((s) => s.width))
    const tallest = Math.max(...Object.values(sizes).map((s) => s.height))
    console.log(
      `Largest variant: ${widest}x${tallest} CSS px (canvas ${EMAIL_LOCKUP.width}x${EMAIL_LOCKUP.height})`,
    )
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
