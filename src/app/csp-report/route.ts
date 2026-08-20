/**
 * Receives Content-Security-Policy violation reports (see next.config.ts —
 * the CSP currently runs in Report-Only mode). Browsers POST here anonymously;
 * reports are written to the server log, which on Vercel means the function
 * logs. Used to tune the policy before ever enforcing it.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.text()

    // Reports are small JSON documents; ignore anything oversized.
    if (body.length > 0 && body.length <= 16_384) {
      console.warn('[csp-report]', body.slice(0, 4_096))
    }
  } catch {
    // A malformed report is not worth an error response
  }

  return new Response(null, { status: 204 })
}
