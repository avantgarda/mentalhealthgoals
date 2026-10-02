/** User-run orchestration; default dry run, explicit production apply. */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { argument, createCmsClient, requireCredentials, resolveDeployment } from './lib/cms-client'
import { assessChange, checkCanary, validatePlan } from './lib/content-patch-core'
import { readChange, runContentPatch } from './lib/content-patch-runner'

const args = process.argv.slice(2)
const booleanOptions = [
  '--apply',
  '--allow-production',
  '--reverse',
  '--preflight',
  '--validate',
  '--verify-only',
]
const valueOptions = ['--plan', '--deployment']

function main() {
  for (let i = 0; i < args.length; i++) {
    if (valueOptions.includes(args[i])) {
      argument(args, args[i])
      i++
    } else if (!booleanOptions.includes(args[i])) throw new Error(`Unknown option: ${args[i]}`)
  }
  if (args.includes('--apply') && args.includes('--verify-only'))
    throw new Error('Choose --apply or --verify-only')
  const planFile = resolve(argument(args, '--plan'))
  const plan = validatePlan(JSON.parse(readFileSync(planFile, 'utf8')))
  if (args.includes('--validate')) {
    console.log(`Valid reviewed plan: ${plan.name}. No CMS requests made.`)
    return
  }
  const explicitHost = argument(args, '--deployment', false)
  const host = explicitHost || 'mentalhealthgoals.vercel.app'
  const deployment = resolveDeployment(host)
  if (!explicitHost && deployment.environment !== 'production')
    throw new Error(
      'The permanent alias must resolve to this project’s READY production deployment',
    )
  const apply = args.includes('--apply')
  if (apply && deployment.environment === 'production' && !args.includes('--allow-production'))
    throw new Error('Production writes require --apply --allow-production after content approval')
  if (args.includes('--preflight')) {
    const client = createCmsClient(deployment.hostname)
    try {
      const response = client.api('/api/pages?depth=0&limit=1')
      if (!Array.isArray(response.docs) || typeof response.totalDocs !== 'number')
        throw new Error(
          'Public CMS read failed; check deployment protection and the linked project',
        )
      console.log(
        `Preflight passed: ${deployment.environment} ${deployment.hostname}; Vercel metadata and public CMS transport work. No CMS login or content writes.`,
      )
    } finally {
      client.dispose()
    }
    return
  }
  const { email, password } = requireCredentials()
  checkCanary(deployment.environment, email)
  const client = createCmsClient(deployment.hostname)
  const directory = join(
    dirname(planFile),
    'backups',
    new Date().toISOString().replace(/[:.]/g, '-'),
  )
  try {
    client.login(email, password)
    console.log(
      `${apply ? 'APPLY' : args.includes('--verify-only') ? 'VERIFY' : 'DRY RUN'}: ${deployment.environment} ${deployment.hostname}`,
    )
    const resolved = runContentPatch(client, deployment, plan, {
      apply: false,
      reverse: args.includes('--reverse'),
    })
    if (!apply && !args.includes('--verify-only')) {
      console.log('Dry run complete. No content was written.')
      return
    }
    if (args.includes('--verify-only')) {
      for (const change of resolved.changes)
        if (assessChange(readChange(client, change), change) !== 'already applied')
          throw new Error(`Update has not been applied: ${change.match.value}`)
      delete resolved.createPartners
    }
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    writeFileSync(join(directory, 'plan.json'), JSON.stringify(plan, null, 2), { mode: 0o600 })
    const finalPlan = apply
      ? runContentPatch(client, deployment, plan, {
          apply: true,
          allowProduction: args.includes('--allow-production'),
          reverse: args.includes('--reverse'),
          backupDir: directory,
        })
      : resolved
    const resolvedFile = join(directory, 'resolved-plan.json')
    writeFileSync(resolvedFile, JSON.stringify(finalPlan, null, 2), { mode: 0o600 })
    const receipt = {
      ...deployment,
      plan: plan.name,
      applied: apply,
      checkedAt: new Date().toISOString(),
      automatedVerification: 'pending',
      liveWebsiteReview: 'pending',
    }
    const save = () =>
      writeFileSync(join(directory, 'run.json'), JSON.stringify(receipt, null, 2), { mode: 0o600 })
    save()
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'scripts/content-verify.ts',
        '--deployment',
        deployment.hostname,
        '--plan',
        resolvedFile,
      ],
      {
        env: process.env,
        stdio: 'inherit',
      },
    )
    receipt.automatedVerification = result.status === 0 ? 'passed' : 'failed'
    save()
    if (result.status !== 0)
      throw new Error(
        `Automated verification stopped. Inspect ${directory}; content writes may have completed. Do not rebuild the plan from the new state.`,
      )
    console.log(
      `Automated checks passed. Live desktop/mobile and related-content review is still required. Receipts: ${directory}`,
    )
  } finally {
    client.dispose()
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : 'CMS handoff failed')
  process.exitCode = 1
}
