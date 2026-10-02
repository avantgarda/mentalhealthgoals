/** Low-level patch command. For a prompted, verified handoff use content:run. */
import { readFileSync, writeFileSync } from 'node:fs'
import { argument, createCmsClient, requireCredentials, resolveDeployment } from './lib/cms-client'
import { checkCanary, validatePlan } from './lib/content-patch-core'
import { runContentPatch } from './lib/content-patch-runner'

const args = process.argv.slice(2)
function main() {
  const plan = validatePlan(JSON.parse(readFileSync(argument(args, '--plan'), 'utf8')))
  const deployment = resolveDeployment(argument(args, '--deployment'))
  const apply = args.includes('--apply')
  if (deployment.environment === 'production' && apply && !args.includes('--allow-production'))
    throw new Error('Production writes require --allow-production after content approval')
  const { email, password } = requireCredentials()
  checkCanary(deployment.environment, email)
  const client = createCmsClient(deployment.hostname)
  try {
    client.login(email, password)
    console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${deployment.environment} ${deployment.hostname}`)
    const resolved = runContentPatch(client, deployment, plan, {
      apply,
      allowProduction: args.includes('--allow-production'),
      reverse: args.includes('--reverse'),
      backupDir: apply ? argument(args, '--backup-dir') : undefined,
    })
    const output = argument(args, '--resolved-plan', false)
    if (output) writeFileSync(output, JSON.stringify(resolved, null, 2), { mode: 0o600 })
  } finally {
    client.dispose()
  }
}
try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Content update failed')
  process.exitCode = 1
}
