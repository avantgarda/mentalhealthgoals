import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)
import { redirects } from './redirects'

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.__NEXT_PRIVATE_ORIGIN || 'http://localhost:3000'

const nextConfig: NextConfig = {
  // Temporarily required on Windows until Next.js fixes Turbopack Sass resolution.
  // See: https://github.com/vercel/next.js/issues/86431
  sassOptions: {
    loadPaths: ['./node_modules/@payloadcms/ui/dist/scss/'],
  },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
    // AVIF first (roughly 20% smaller than WebP at the same quality), WebP for
    // browsers without it, original format as the final fallback.
    formats: ['image/avif', 'image/webp'],
    // 82 is the site default (visually lossless for photographs); 100 stays in
    // the allowlist so URLs cached before the default changed keep resolving.
    qualities: [82, 100],
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL /* 'https://example.com' */].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', '') as 'http' | 'https',
        }
      }),
    ],
  },
  // The seed reads its .webp assets from disk at runtime (src/endpoints/seed/index.ts).
  // Next.js can't trace a computed readFileSync path, so include them explicitly —
  // without this the admin Seed button throws "Seed asset not found" in production.
  outputFileTracingIncludes: {
    '/next/seed': [
      './src/endpoints/seed/*.png',
      './src/endpoints/seed/images/*.jpg',
      './src/endpoints/seed/logos/*',
    ],
    // The well-known icon routes read the current variant's file from disk so
    // they can answer 200 (icon scrapers refuse redirects) — every variant is
    // traced because the Brand global decides at runtime.
    '/favicon.ico': ['./public/brand/*/favicon-32.png'],
    '/favicon.png': ['./public/brand/*/favicon-32.png'],
    '/favicon.svg': ['./public/brand/*/favicon.svg'],
    '/apple-touch-icon.png': ['./public/brand/*/apple-touch-icon.png'],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  reactStrictMode: true,
  poweredByHeader: false,
  // Vercel only sets HSTS by itself — the rest is on us. X-Frame-Options is
  // SAMEORIGIN (not DENY) because the admin panel's live preview iframes the
  // frontend on the same origin.
  //
  // The CSP runs in REPORT-ONLY mode: nothing is blocked, violations are
  // POSTed to /csp-report and appear in the Vercel function logs. Once the
  // logs stay quiet across real editing + browsing, rename the header to
  // Content-Security-Policy to enforce it. 'unsafe-inline' is required by
  // Next's bootstrap scripts and the admin UI's inline styles; the vercel.live
  // entries cover Vercel's preview-deployment toolbar. Production only —
  // dev-mode HMR uses eval and would drown the reports in noise.
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ...(process.env.NODE_ENV === 'production'
          ? [
              { key: 'Reporting-Endpoints', value: 'csp-endpoint="/csp-report"' },
              {
                key: 'Content-Security-Policy-Report-Only',
                value: [
                  "default-src 'self'",
                  "script-src 'self' 'unsafe-inline' https://vercel.live",
                  "style-src 'self' 'unsafe-inline'",
                  // gravatar: the admin panel loads user avatars from there
                  // (first real /csp-report finding, 2026-08-20). The
                  // vercel.live / vercel.com / pusher entries are the Vercel
                  // toolbar, which injects itself into preview deployments and
                  // warns when a CSP would block its assets — harmless while
                  // this header is report-only, but adding them keeps the
                  // /csp-report logs clean and means enforcing later will not
                  // break previews.
                  "img-src 'self' blob: data: https://www.gravatar.com https://vercel.live https://vercel.com",
                  "font-src 'self' data: https://vercel.live https://assets.vercel.com",
                  "connect-src 'self' https://vercel.live wss://ws-us3.pusher.com",
                  "frame-src 'self' https://vercel.live",
                  "worker-src 'self' blob:",
                  "object-src 'none'",
                  "base-uri 'self'",
                  "form-action 'self'",
                  'report-uri /csp-report',
                  'report-to csp-endpoint',
                ].join('; '),
              },
            ]
          : []),
      ],
    },
    // Pre-launch: keep the draft site out of search indexes. Set SITE_NOINDEX=1
    // in Vercel until launch; on launch day delete the env var and redeploy.
    // Evaluated at build time, so changing the var requires a redeploy.
    ...(process.env.SITE_NOINDEX
      ? [
          {
            source: '/(.*)',
            headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
          },
        ]
      : []),
  ],
  redirects,
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
