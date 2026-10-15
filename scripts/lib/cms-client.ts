/**
 * Talk to a deployed Payload instance through the Vercel CLI.
 *
 * `vercel curl` is what gets past deployment protection: it resolves the
 * deployment from the linked project and attaches the bypass, so the same code
 * reaches an SSO-protected preview and the public production alias. Headers —
 * including the session token after login — travel in a private curl config
 * file rather than on the command line, and nothing a request returns is ever
 * echoed on failure: login responses carry tokens.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export type Environment = 'preview' | 'production'

export type Deployment = {
  hostname: string
  environment: Environment
  /** The git commit the deployment was built from, when Vercel knows it. */
  commit?: string
}

const env = { ...process.env, CI: '1', NO_UPDATE_NOTIFIER: '1' }

function vercel(parameters: string[], timeout = 90_000): string {
  const result = spawnSync('vercel', parameters, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    timeout,
    env,
  })
  if (result.status !== 0) {
    const operation = parameters.includes('api') ? 'api' : parameters[0]
    const timedOut = result.error && 'code' in result.error && result.error.code === 'ETIMEDOUT'
    if (result.signal && !timedOut)
      throw new Error(`vercel ${operation} was stopped (${result.signal}); the run stops here`)
    // Classify without echoing stderr, bodies or arguments: any of those may
    // contain authentication material. Scope belongs to metadata, never curl.
    const hint =
      result.error && 'code' in result.error && result.error.code === 'ENOENT'
        ? 'Install the Vercel CLI and ensure it is on PATH.'
        : result.status === 2 && parameters[0] === 'curl'
          ? 'Check the Vercel CLI/curl invocation; do not forward --scope to curl.'
          : result.status === 22
            ? 'The deployment returned an HTTP error; check the target and CMS access.'
            : 'Check Vercel login, the linked project and deployment access.'
    throw new Error(`vercel ${operation} failed (exit ${result.status ?? 'timeout'}). ${hint}`)
  }
  return result.stdout
}

/**
 * Confirm a hostname is a READY deployment of the linked project and learn
 * which environment it serves. The environment is Vercel's label — it says
 * nothing about which database the deployment reads; `checkCanary` in
 * ./content-patch-core is what settles that.
 */
export function resolveDeployment(hostArg: string): Deployment {
  const url = new URL(`https://${hostArg.replace(/^https?:\/\//, '')}`)
  if (
    !url.hostname.endsWith('.vercel.app') ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.port ||
    url.username ||
    url.password
  ) {
    throw new Error('Use an exact Vercel deployment hostname')
  }
  const project = JSON.parse(readFileSync('.vercel/project.json', 'utf8'))
  const meta = JSON.parse(
    vercel([
      '--scope',
      project.orgId,
      'api',
      `/v13/deployments/${url.hostname}?teamId=${project.orgId}`,
      '--method',
      'GET',
      '--raw',
    ]),
  )
  if (meta.projectId !== project.projectId || meta.readyState !== 'READY') {
    throw new Error('Deployment must belong to this project and be READY')
  }
  return {
    hostname: url.hostname,
    environment: meta.target === 'production' ? 'production' : 'preview',
    commit: meta.meta?.githubCommitSha,
  }
}

export type UploadFile = { bytes: Buffer; filename: string; mimeType: string }

export type CmsClient = {
  /** A JSON API request. Throws on any non-2xx without exposing the body. */
  api: (path: string, method?: string, data?: unknown) => ReturnType<typeof JSON.parse>
  /** A multipart upload to an upload collection: the file, and its other
   * fields as Payload's `_payload`. Throws like `api`. */
  upload: (
    path: string,
    file: UploadFile,
    data: Record<string, unknown>,
  ) => ReturnType<typeof JSON.parse>
  /** A file's bytes. Throws unless it is served in full (200). */
  download: (path: string) => Buffer
  /** The first byte of a file, for its status and headers (lower-cased
   * names): Payload's file route does not answer HEAD. Never throws on status. */
  probe: (path: string) => { status: number; headers: Record<string, string> }
  /** A rendered page, following redirects. Never throws on HTTP status. */
  page: (path: string) => { status: number; html: string }
  login: (email: string, password: string) => void
  /** Ends the session server-side and removes every local trace of it. */
  dispose: () => void
}

export function createCmsClient(hostname: string): CmsClient {
  const scratch = mkdtempSync(join(tmpdir(), 'mhg-cms-'))
  const configFile = join(scratch, 'curl.conf')
  writeFileSync(configFile, 'header = "Content-Type: application/json"\n', { mode: 0o600 })
  // The session alone, for requests that are not JSON: given a JSON
  // Content-Type, curl would send a multipart upload under that type.
  const sessionFile = join(scratch, 'session.conf')
  writeFileSync(sessionFile, '', { mode: 0o600 })
  let sequence = 0
  let authenticated = false

  const curl = (path: string, extra: string[], seconds = 60) =>
    vercel(
      [
        'curl',
        path,
        '--deployment',
        hostname,
        '--',
        '--globoff',
        '--silent',
        '--show-error',
        '--max-time',
        String(seconds),
        ...extra,
      ],
      (seconds + 30) * 1000,
    )

  const api: CmsClient['api'] = (path, method = 'GET', data) => {
    const extra = ['--fail-with-body', '--config', configFile, '--request', method]
    // Removed as soon as it is sent: the login body holds the password.
    const body = data === undefined ? undefined : join(scratch, `request-${sequence++}.json`)
    if (body) {
      writeFileSync(body, JSON.stringify(data), { mode: 0o600 })
      extra.push('--data-binary', `@${body}`)
    }
    let response
    try {
      response = curl(path, extra)
    } finally {
      if (body) rmSync(body, { force: true })
    }
    try {
      return JSON.parse(response)
    } catch {
      throw new Error('CMS returned an invalid JSON response; response withheld')
    }
  }

  const upload: CmsClient['upload'] = (path, file, data) => {
    // A private copy under a plain name: curl's form syntax would misread a
    // path or filename containing `;` or `,`, and these are neither.
    const copy = join(scratch, `upload-${sequence++}`)
    writeFileSync(copy, file.bytes, { mode: 0o600 })
    try {
      // Up to 4 MB over a home connection: a longer limit than other requests.
      const response = curl(
        path,
        [
          '--config',
          sessionFile,
          '--form',
          `file=@${copy};type=${file.mimeType};filename=${file.filename}`,
          '--form-string',
          `_payload=${JSON.stringify(data)}`,
          '--write-out',
          '\n%{http_code}',
        ],
        300,
      )
      const cut = response.lastIndexOf('\n')
      const status = Number(response.slice(cut + 1))
      let body
      try {
        body = JSON.parse(response.slice(0, cut))
      } catch {
        body = undefined
      }
      if (!(status >= 200 && status < 300)) {
        // Unlike a login's, an upload's refusal holds nothing secret, and it is
        // the only clue to why: 413 is the size limit, 401 or 403 the session,
        // and Payload's messages name a file it will not take.
        const errors: unknown[] = Array.isArray(body?.errors) ? body.errors : []
        const reasons = errors
          .map((e) => (e && typeof e === 'object' ? (e as { message?: unknown }).message : ''))
          .filter((m): m is string => typeof m === 'string' && m.length > 0)
          .join('; ')
          .slice(0, 300)
        throw new Error(
          `Media refused the upload (HTTP ${status || 'none'})${reasons ? `: ${reasons}` : ''}`,
        )
      }
      if (body === undefined)
        throw new Error('CMS returned an invalid JSON response; response withheld')
      return body
    } finally {
      rmSync(copy, { force: true })
    }
  }

  const download: CmsClient['download'] = (path) => {
    const out = join(scratch, `download-${sequence++}`)
    try {
      // Anything but 200 is not the file: Payload's Blob route answers 204,
      // with no body, when it cannot fetch one.
      const status = curl(
        path,
        ['--fail', '--config', sessionFile, '--output', out, '--write-out', '%{http_code}'],
        300,
      )
      if (status.trim() !== '200')
        throw new Error(`Media served HTTP ${status.trim()}, not the file`)
      return readFileSync(out)
    } finally {
      rmSync(out, { force: true })
    }
  }

  const probe: CmsClient['probe'] = (path) => {
    const head = join(scratch, `probe-${sequence}.headers`)
    const body = join(scratch, `probe-${sequence++}.body`)
    try {
      curl(path, [
        '--config',
        sessionFile,
        '--range',
        '0-0',
        '--dump-header',
        head,
        '--output',
        body,
      ])
      // The last response's block, should anything precede it (a 100 Continue).
      const lines = readFileSync(head, 'utf8')
        .trim()
        .split(/\r?\n\r?\n/)
        .at(-1)!
        .split(/\r?\n/)
      const headers: Record<string, string> = {}
      for (const line of lines.slice(1)) {
        const at = line.indexOf(':')
        if (at > 0) headers[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim()
      }
      return { status: Number(lines[0].split(' ')[1]), headers }
    } finally {
      rmSync(head, { force: true })
      rmSync(body, { force: true })
    }
  }

  const page: CmsClient['page'] = (path) => {
    const out = curl(path, ['--location', '--write-out', '\n%{http_code}'])
    const cut = out.lastIndexOf('\n')
    return { status: Number(out.slice(cut + 1)), html: out.slice(0, cut) }
  }

  const login: CmsClient['login'] = (email, password) => {
    let result
    try {
      result = api('/api/users/login', 'POST', { email, password })
    } catch {
      throw new Error(
        'CMS login failed. Check the CMS login for this deployment (local seed accounts do not work on production) and deployment access. No content was written.',
      )
    }
    if (!result.token || !result.user) throw new Error('CMS authentication failed')
    const session = `header = "Authorization: JWT ${result.token}"\n`
    writeFileSync(configFile, `header = "Content-Type: application/json"\n${session}`, {
      mode: 0o600,
    })
    writeFileSync(sessionFile, session, { mode: 0o600 })
    authenticated = true
  }

  const dispose: CmsClient['dispose'] = () => {
    if (authenticated) {
      try {
        api('/api/users/logout', 'POST', {})
      } catch {
        console.warn('Session logout failed; token was discarded locally')
      }
      authenticated = false
    }
    rmSync(scratch, { recursive: true, force: true })
  }

  return { api, upload, download, probe, page, login, dispose }
}

/** The editor login every content script expects in its environment. */
export function requireCredentials(): { email: string; password: string } {
  const { MHG_CMS_EMAIL: email, MHG_CMS_PASSWORD: password } = process.env
  if (!email || !password) {
    throw new Error('Set MHG_CMS_EMAIL and MHG_CMS_PASSWORD in the process environment')
  }
  return { email, password }
}

/** Minimal `--flag value` parsing shared by the content scripts. */
export function argument(args: string[], name: string, required = true): string {
  const at = args.indexOf(name)
  const value = at === -1 ? undefined : args[at + 1]
  if (!value || value.startsWith('--')) {
    if (required) throw new Error(`Missing ${name}`)
    return ''
  }
  return value
}
