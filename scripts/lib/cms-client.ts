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

function vercel(parameters: string[]): string {
  const result = spawnSync('vercel', parameters, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    timeout: 90_000,
    env,
  })
  if (result.status !== 0) {
    throw new Error(`vercel request failed (exit ${result.status ?? 'timeout'})`)
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
  if (!url.hostname.endsWith('.vercel.app') || url.pathname !== '/') {
    throw new Error('Use an exact Vercel deployment hostname')
  }
  const project = JSON.parse(readFileSync('.vercel/project.json', 'utf8'))
  const meta = JSON.parse(
    vercel([
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

export type CmsClient = {
  /** A JSON API request. Throws on any non-2xx without exposing the body. */
  api: (path: string, method?: string, data?: unknown) => ReturnType<typeof JSON.parse>
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
  let sequence = 0
  let authenticated = false

  const curl = (path: string, extra: string[]) =>
    vercel([
      'curl',
      path,
      '--deployment',
      hostname,
      '--',
      '--globoff',
      '--silent',
      '--show-error',
      '--max-time',
      '60',
      ...extra,
    ])

  const api: CmsClient['api'] = (path, method = 'GET', data) => {
    const extra = ['--fail-with-body', '--config', configFile, '--request', method]
    if (data !== undefined) {
      const body = join(scratch, `request-${sequence++}.json`)
      writeFileSync(body, JSON.stringify(data), { mode: 0o600 })
      extra.push('--data-binary', `@${body}`)
    }
    return JSON.parse(curl(path, extra))
  }

  const page: CmsClient['page'] = (path) => {
    const out = curl(path, ['--location', '--write-out', '\n%{http_code}'])
    const cut = out.lastIndexOf('\n')
    return { status: Number(out.slice(cut + 1)), html: out.slice(0, cut) }
  }

  const login: CmsClient['login'] = (email, password) => {
    const result = api('/api/users/login', 'POST', { email, password })
    if (!result.token || !result.user) throw new Error('CMS authentication failed')
    writeFileSync(
      configFile,
      `header = "Content-Type: application/json"\nheader = "Authorization: JWT ${result.token}"\n`,
      { mode: 0o600 },
    )
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

  return { api, page, login, dispose }
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
