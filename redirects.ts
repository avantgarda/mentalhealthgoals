import type { NextConfig } from 'next'

// Static redirects live here (dynamic, editor-managed redirects come from the
// Payload redirects plugin). Currently none.
export const redirects: NextConfig['redirects'] = async () => {
  return []
}
