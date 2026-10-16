import { describe, expect, it } from 'vitest'
import { getPayloadServerURL } from '@/utilities/getPayloadServerURL'

describe('CMS link origin', () => {
  it('uses the canonical production URL and ignores the deployment hostname', () => {
    expect(
      getPayloadServerURL({
        VERCEL_ENV: 'production',
        NEXT_PUBLIC_SERVER_URL: 'https://www.mentalhealthgoals.co.uk/',
        VERCEL_URL: 'build.vercel.app',
      }),
    ).toBe('https://www.mentalhealthgoals.co.uk')
  })
  it('keeps preview auth links on the preview even with a copied public URL', () => {
    expect(
      getPayloadServerURL({
        VERCEL_ENV: 'preview',
        VERCEL_URL: 'preview.vercel.app',
        NEXT_PUBLIC_SERVER_URL: 'https://www.mentalhealthgoals.co.uk',
      }),
    ).toBe('https://preview.vercel.app')
    expect(() => getPayloadServerURL({ VERCEL_ENV: 'preview' })).toThrow()
  })
  it('supports a dedicated local port', () => {
    expect(getPayloadServerURL({ NEXT_PUBLIC_SERVER_URL: 'http://localhost:3210' })).toBe(
      'http://localhost:3210',
    )
    expect(getPayloadServerURL({})).toBe('http://localhost:3000')
    expect(
      getPayloadServerURL({
        VERCEL_ENV: 'development',
        VERCEL_PROJECT_PRODUCTION_URL: 'www.mentalhealthgoals.co.uk',
      }),
    ).toBe('http://localhost:3000')
  })
  it('rejects ambiguous and insecure remote origins', () => {
    for (const value of [
      'http://example.com',
      'https://user:pass@example.com',
      'https://example.com/path',
      'https://example.com/?x=1',
      'https://example.com/#fragment',
    ]) {
      expect(() => getPayloadServerURL({ NEXT_PUBLIC_SERVER_URL: value })).toThrow()
    }
    expect(() => getPayloadServerURL({ VERCEL_ENV: 'production' })).toThrow()
  })
})
