/**
 * A temporary editor on a preview database branch — the canary that proves a
 * preview deployment is reading its own branch.
 *
 *   pnpm content:editor create --dir temp/<plan-name> [--branch <neon-branch-id>]
 *   pnpm content:editor delete --dir temp/<plan-name>
 *
 * The account is created directly on the Neon branch, never through a
 * deployment, and only after the branch is confirmed to be a non-primary child
 * of `main` on a compute endpoint that is not production's. Its address is
 * under the reserved `.invalid` TLD, so it can never be a real person; the
 * content scripts refuse to run against a preview with anything else. The
 * credentials go to `<dir>/preview-credentials.json`, mode 0600, and `delete`
 * removes both the account and the file.
 *
 * The branch defaults to `preview/<current git branch>`, which is how the
 * Vercel–Neon integration names them.
 */
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { argument } from './lib/cms-client'
import { isCanaryAddress } from './lib/content-patch-core'
import { NEON_PROJECT_ID, PRODUCTION_NEON_ENDPOINT_HOST } from './lib/production-identifiers'

const args = process.argv.slice(2)
const action = args[0]
if (action !== 'create' && action !== 'delete')
  throw new Error('Usage: create|delete --dir <plan-dir>')
const dir = argument(args, '--dir')
const credentialsFile = join(dir, 'preview-credentials.json')

function neon(parameters: string[]): string {
  const result = spawnSync(
    'neonctl',
    [...parameters, '--project-id', NEON_PROJECT_ID, '--no-analytics'],
    { encoding: 'utf8', timeout: 60_000 },
  )
  if (result.status !== 0) throw new Error(`neonctl ${parameters[0]} failed`)
  return result.stdout.trim()
}

type Branch = { id: string; name: string; primary?: boolean; parent_id?: string }

function resolveBranch(): Branch {
  const branches: Branch[] = JSON.parse(neon(['branches', 'list', '--output', 'json']))
  const primary = branches.find((b) => b.primary)
  if (!primary) throw new Error('No primary Neon branch found')
  const wanted = argument(args, '--branch', false)
  const gitBranch = spawnSync('git', ['branch', '--show-current'], {
    encoding: 'utf8',
  }).stdout.trim()
  const target = wanted
    ? branches.find((b) => b.id === wanted || b.name === wanted)
    : branches.find((b) => b.name === `preview/${gitBranch}`)
  if (!target) {
    throw new Error(
      `No Neon branch ${wanted ? `"${wanted}"` : `named preview/${gitBranch}`}. ` +
        'Has this git branch had a preview deployment yet? Pass --branch <id> to choose one.',
    )
  }
  if (target.primary || target.parent_id !== primary.id) {
    throw new Error(`${target.name} is not a child of ${primary.name}; refusing`)
  }
  return target
}

async function connect(branch: Branch) {
  const connection = neon([
    'connection-string',
    branch.id,
    '--role-name',
    'neondb_owner',
    '--database-name',
    'neondb',
  ])
  const host = new URL(connection).hostname
  if (!host.endsWith('.neon.tech') || host === PRODUCTION_NEON_ENDPOINT_HOST) {
    throw new Error('Refusing: that connection string points at production or off Neon')
  }
  process.env.DATABASE_URL = connection
  process.env.PAYLOAD_SECRET = randomBytes(32).toString('hex')
  process.env.PAYLOAD_DB_PUSH = '0'
  process.env.VERCEL_ENV = 'preview'
  delete process.env.RESEND_API_KEY
  const { getPayload } = await import('payload')
  const config = (await import('../src/payload.config')).default
  return getPayload({ config })
}

async function main() {
  if (action === 'create') {
    if (existsSync(credentialsFile)) throw new Error(`${credentialsFile} exists; delete first`)
    const branch = resolveBranch()
    const payload = await connect(branch)
    try {
      const email = `content-review-${randomBytes(4).toString('hex')}@mentalhealthgoals.invalid`
      const password = randomBytes(32).toString('base64url')
      const user = await payload.create({
        collection: 'users',
        overrideAccess: true,
        data: { email, password, name: 'Temporary content review editor', role: 'editor' },
      })
      writeFileSync(
        credentialsFile,
        JSON.stringify({
          email,
          password,
          userId: user.id,
          branchId: branch.id,
          branch: branch.name,
        }),
        { mode: 0o600 },
      )
      console.log(`Created ${email} on ${branch.name} (${branch.id}) → ${credentialsFile}`)
      console.log(
        'Load it with: export MHG_CMS_EMAIL=$(node -e "console.log(require(\'./' +
          credentialsFile +
          '\').email)") …',
      )
    } finally {
      await payload.db.destroy?.()
    }
  } else {
    if (!existsSync(credentialsFile)) throw new Error(`${credentialsFile} not found`)
    const saved = JSON.parse(readFileSync(credentialsFile, 'utf8'))
    if (!isCanaryAddress(saved.email)) throw new Error('Refusing to delete a non-canary account')
    const branches: Branch[] = JSON.parse(neon(['branches', 'list', '--output', 'json']))
    const branch = branches.find((b) => b.id === saved.branchId)
    if (!branch) {
      // The integration deletes branches when their PR closes; the account went with it.
      rmSync(credentialsFile, { force: true })
      console.log(`Branch ${saved.branchId} no longer exists; removed ${credentialsFile}`)
      return
    }
    if (branch.primary) throw new Error('Refusing to touch the primary branch')
    const payload = await connect(branch)
    try {
      const existing = await payload
        .findByID({ collection: 'users', id: saved.userId, overrideAccess: true })
        .catch(() => null)
      if (existing && existing.email === saved.email) {
        await payload.delete({ collection: 'users', id: saved.userId, overrideAccess: true })
        console.log(`Deleted ${saved.email} from ${branch.name}`)
      } else console.log('Temporary editor already absent')
    } finally {
      await payload.db.destroy?.()
    }
    rmSync(credentialsFile, { force: true })
    console.log(`Removed ${credentialsFile}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Failed')
    process.exit(1)
  })
