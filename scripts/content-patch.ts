/** Apply a reviewed, private content plan through a deployed Payload API.
 * Content plans and backups belong in temp/, never in committed migrations.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  assessChange,
  isUnpublishedDraft,
  matchValues,
  sameDocument,
  validatePlan,
  type ContentChange,
} from './lib/content-patch-core'

const args = process.argv.slice(2)
const option = (name: string) => args[args.indexOf(name) + 1]
const required = (name: string) => {
  if (!args.includes(name) || !option(name) || option(name).startsWith('--')) {
    throw new Error(`Missing ${name}`)
  }
  return option(name)
}

async function main() {
  const deployment = new URL(`https://${required('--deployment').replace(/^https:\/\//, '')}`)
  if (!deployment.hostname.endsWith('.vercel.app') || deployment.pathname !== '/') {
    throw new Error('Use an exact Vercel deployment hostname')
  }
  const plan = validatePlan(JSON.parse(readFileSync(required('--plan'), 'utf8')))
  if (args.includes('--reverse')) {
    plan.changes = plan.changes.map((change) => ({
      ...change,
      before: change.after,
      after: change.before,
    }))
  }
  const apply = args.includes('--apply')
  const project = JSON.parse(readFileSync('.vercel/project.json', 'utf8'))
  const run = (command: string, parameters: string[]) => {
    const result = spawnSync(command, parameters, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 90_000,
      env: { ...process.env, CI: '1', NO_UPDATE_NOTIFIER: '1' },
    })
    if (result.status !== 0) {
      // Never echo curl output or command arguments: login responses contain tokens.
      throw new Error(`${command} request failed (exit ${result.status ?? 'timeout'})`)
    }
    return JSON.parse(result.stdout)
  }
  const meta = run('vercel', [
    'api',
    `/v13/deployments/${deployment.hostname}?teamId=${project.orgId}`,
    '--method',
    'GET',
    '--raw',
  ])
  if (meta.projectId !== project.projectId || meta.readyState !== 'READY') {
    throw new Error('Deployment must belong to this project and be READY')
  }
  const environment = meta.target === 'production' ? 'production' : 'preview'
  if (environment === 'production' && apply && !args.includes('--allow-production')) {
    throw new Error('Production writes require --allow-production after content approval')
  }
  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${environment} ${deployment.hostname}`)

  const scratch = mkdtempSync(join(tmpdir(), 'mhg-content-patch-'))
  const configFile = join(scratch, 'curl.conf')
  let authenticated = false
  let sequence = 0
  const api = (path: string, method = 'GET', data?: unknown) => {
    const curl = [
      '--globoff',
      '--silent',
      '--show-error',
      '--fail-with-body',
      '--max-time',
      '60',
      '--config',
      configFile,
      '--request',
      method,
    ]
    if (data !== undefined) {
      const body = join(scratch, `request-${sequence++}.json`)
      writeFileSync(body, JSON.stringify(data), { mode: 0o600 })
      curl.push('--data-binary', `@${body}`)
    }
    return run('vercel', ['curl', path, '--deployment', deployment.hostname, '--', ...curl])
  }
  const read = (change: ContentChange) => {
    // Match on the baseline name and the rewritten one at once: exactly one record
    // must answer to either, whether or not this plan has already been applied.
    const names = matchValues(change)
    const query = new URLSearchParams({ depth: '0', limit: '2', draft: 'true' })
    names.forEach((name, i) => query.set(`where[or][${i}][${change.match.field}][equals]`, name))
    const result = api(`/api/${change.collection}?${query}`)
    if (result.totalDocs !== 1 || result.docs?.length !== 1) {
      throw new Error(`Expected exactly one ${change.collection}: ${names.join(' or ')}`)
    }
    const doc = result.docs[0]
    if (isUnpublishedDraft(doc)) {
      throw new Error(`Unpublished draft needs review: ${change.match.value}`)
    }
    return doc
  }

  try {
    writeFileSync(configFile, 'header = "Content-Type: application/json"\n', { mode: 0o600 })
    if (!process.env.MHG_CMS_EMAIL || !process.env.MHG_CMS_PASSWORD) {
      throw new Error('Set MHG_CMS_EMAIL and MHG_CMS_PASSWORD in the process environment')
    }
    const login = api('/api/users/login', 'POST', {
      email: process.env.MHG_CMS_EMAIL,
      password: process.env.MHG_CMS_PASSWORD,
    })
    if (!login.token || !login.user) throw new Error('CMS authentication failed')
    writeFileSync(
      configFile,
      `header = "Content-Type: application/json"\nheader = "Authorization: JWT ${login.token}"\n`,
      { mode: 0o600 },
    )
    authenticated = true

    // Check the entire plan before the first write. Resolve each environment's own IDs.
    const originals = plan.changes.map((change) => {
      const doc = read(change)
      const state = assessChange(doc, change)
      console.log(
        `${state}: ${change.collection}/${change.match.value} [${Object.keys(change.after).join(', ')}]`,
      )
      return { change, doc, state }
    })
    if (!apply) return
    const directory = resolve(required('--backup-dir'))
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    const backupFile = join(directory, `content-backup-${Date.now()}.json`)
    const receipt = {
      deployment: deployment.hostname,
      environment,
      planName: plan.name,
      createdAt: new Date().toISOString(),
      originals,
      writes: [] as {
        collection: string
        target: string
        id: number | string
        status: 'in flight' | 'written' | 'verified'
        updatedAt: string
      }[],
    }
    const save = () => writeFileSync(backupFile, JSON.stringify(receipt, null, 2), { mode: 0o600 })
    save()
    console.log(`Backup: ${backupFile}`)
    for (const { change, doc: original, state } of originals) {
      if (state === 'already applied') continue
      const current = read(change)
      if (
        current.id !== original.id ||
        current.updatedAt !== original.updatedAt ||
        !sameDocument(current, original)
      ) {
        throw new Error(`Content changed during this run: ${change.match.value}`)
      }
      assessChange(current, change)
      // Record the intent before the request, not after it succeeds. A write can
      // land while the response is lost, and a read-back can fail on a record that
      // was written, so anything recorded only afterwards understates what changed.
      const write = {
        collection: change.collection,
        target: change.match.value,
        id: current.id as number | string,
        status: 'in flight' as 'in flight' | 'written' | 'verified',
        updatedAt: current.updatedAt as string,
      }
      receipt.writes.push(write)
      save()
      // Predicate rechecks updatedAt at the API; no multi-document transaction is promised.
      const query = new URLSearchParams({
        'where[and][0][id][equals]': String(current.id),
        'where[and][1][updatedAt][equals]': current.updatedAt,
        depth: '0',
      })
      const result = api(`/api/${change.collection}?${query}`, 'PATCH', change.after)
      if (result.errors?.length || result.docs?.length !== 1) {
        throw new Error(
          `Update failed or concurrent change detected: ${change.match.value}. Inspect backup before retrying.`,
        )
      }
      write.status = 'written'
      save()
      const saved = read(change)
      if (assessChange(saved, change) !== 'already applied') {
        throw new Error(`Read-back verification failed: ${change.match.value}`)
      }
      write.status = 'verified'
      write.updatedAt = saved.updatedAt
      save()
      console.log(`Verified: ${change.collection}/${change.match.value}`)
    }
  } finally {
    if (authenticated) {
      try {
        api('/api/users/logout', 'POST', {})
      } catch {
        console.warn('Session logout failed; token was discarded locally')
      }
    }
    rmSync(scratch, { recursive: true, force: true })
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Content update failed')
  process.exitCode = 1
})
