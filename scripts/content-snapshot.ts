/**
 * Snapshot every editable collection from a deployment, exactly as
 * `content-patch` will read it back: authenticated, depth 0, latest draft.
 *
 *   MHG_CMS_EMAIL=… MHG_CMS_PASSWORD=… pnpm content:snapshot \
 *     --deployment <host>.vercel.app --dir temp/<plan-name>
 *
 * Take it from a preview branch freshly reset from production, so the baseline
 * the plan is written against is production's current content. Everything is
 * fetched — the site is small — so a plan script never needs to know in advance
 * which records it will touch.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { argument, createCmsClient, requireCredentials, resolveDeployment } from './lib/cms-client'
import { EDITABLE_COLLECTIONS } from './lib/content-patch-core'

const args = process.argv.slice(2)
const deployment = resolveDeployment(argument(args, '--deployment'))
const dir = join(argument(args, '--dir'), 'sources')
const { email, password } = requireCredentials()

const client = createCmsClient(deployment.hostname)
try {
  client.login(email, password)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const counts: Record<string, number> = {}
  for (const collection of EDITABLE_COLLECTIONS) {
    const query = new URLSearchParams({ depth: '0', limit: '500', draft: 'true' })
    const result = client.api(`/api/${collection}?${query}`)
    if (result.totalDocs > result.docs.length) {
      throw new Error(`${collection}: ${result.totalDocs} records exceed one page`)
    }
    writeFileSync(join(dir, `${collection}.json`), JSON.stringify(result.docs, null, 2), {
      mode: 0o600,
    })
    counts[collection] = result.docs.length
  }
  writeFileSync(
    join(dir, 'meta.json'),
    JSON.stringify({ ...deployment, takenAt: new Date().toISOString(), counts }, null, 2),
    { mode: 0o600 },
  )
  console.log(`Snapshot of ${deployment.environment} ${deployment.hostname} → ${dir}`)
  for (const [collection, n] of Object.entries(counts)) console.log(`  ${collection}: ${n}`)
} finally {
  client.dispose()
}
