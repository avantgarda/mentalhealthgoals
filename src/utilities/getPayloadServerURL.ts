type ServerEnvironment = {
  VERCEL_ENV?: string
  VERCEL_URL?: string
  VERCEL_PROJECT_PRODUCTION_URL?: string
  NEXT_PUBLIC_SERVER_URL?: string
}

/** Auth links must point at the database's deployment, not a copied production URL. */
export function getPayloadServerURL(env: ServerEnvironment = process.env): string {
  const preview = env.VERCEL_ENV === 'preview'
  if (preview && !env.VERCEL_URL) throw new Error('Preview auth requires VERCEL_URL.')
  const value = preview
    ? `https://${env.VERCEL_URL}`
    : env.NEXT_PUBLIC_SERVER_URL ||
      (env.VERCEL_ENV !== 'development' && env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
        : 'http://localhost:3000')
  const url = new URL(value)
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/')
    throw new Error(
      'Payload server URL must be an origin without credentials, path, query or fragment.',
    )
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
  )
    throw new Error('Payload server URL must use HTTPS except on localhost.')
  if (env.VERCEL_ENV === 'production' && ['localhost', '127.0.0.1'].includes(url.hostname))
    throw new Error('Production auth requires a public server URL.')
  return url.origin
}
