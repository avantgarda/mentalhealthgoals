/**
 * Prove a deployment shows what a plan says it should — after applying, on
 * preview and again on production.
 *
 *   MHG_CMS_EMAIL=… MHG_CMS_PASSWORD=… pnpm content:verify \
 *     --deployment <host>.vercel.app --plan temp/<plan-name>/plan.json
 *
 * Every expectation is derived from the plan itself: text that appears in a
 * record's revised fields must be visible on its page, long passages that were
 * removed must be gone, links that moved must have moved, and a record whose
 * slug changed must answer at the new path and 404 at the old one. With a login
 * it also confirms each record is found under its new name and carries a
 * version — the proof that the write went through Payload and is reversible.
 *
 * Results are written next to the plan as `verification.json`, recording what
 * was actually matched rather than a bare pass, so they can be read later
 * without being taken on trust.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { argument, createCmsClient, resolveDeployment } from './lib/cms-client'
import { checkCanary, matchValues, validatePlan } from './lib/content-patch-core'
import { deriveExpectations, visibleText } from './lib/content-plan'

const args = process.argv.slice(2)
const deployment = resolveDeployment(argument(args, '--deployment'))
const planFile = argument(args, '--plan')
const plan = validatePlan(JSON.parse(readFileSync(planFile, 'utf8')))
const { MHG_CMS_EMAIL: email, MHG_CMS_PASSWORD: password } = process.env

const client = createCmsClient(deployment.hostname)
const results: Record<string, unknown>[] = []
let failed = 0
const report = (ok: boolean, line: string) => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${line}`)
}

try {
  for (const e of deriveExpectations(plan)) {
    // A record's words may render on more than one page (a workstream's summary
    // sits on the index); a passage counts if any of them shows it, and an old
    // one must be gone from all of them. The status is the record's own page.
    const pages = e.paths.map((path) => ({ path, ...client.page(path) }))
    const status = pages[0].status
    const seen = pages.map((p) => visibleText(p.html))
    const anyText = (s: string) => seen.some((t) => t.includes(s))
    const anyHref = (u: string) => pages.some((p) => p.html.includes(`href="${u}"`))
    const missing = e.expectText.filter((s) => !anyText(s))
    const lingering = e.rejectText.filter(anyText)
    const missingHref = e.expectHref.filter((u) => !anyHref(u))
    const lingeringHref = e.rejectHref.filter(anyHref)
    const ok =
      status === e.expectStatus &&
      !missing.length &&
      !lingering.length &&
      !missingHref.length &&
      !lingeringHref.length
    results.push({
      label: e.label,
      paths: e.paths,
      ok,
      status,
      expectStatus: e.expectStatus,
      found: e.expectText.filter(anyText),
      missing,
      lingering,
      hrefsFound: e.expectHref.filter(anyHref),
      missingHref,
      lingeringHref,
    })
    const detail = [
      status !== e.expectStatus ? `status ${status} (want ${e.expectStatus})` : '',
      missing.length ? `missing ${missing.length} passage(s)` : '',
      lingering.length ? `${lingering.length} old passage(s) still present` : '',
      missingHref.length ? `missing link ${missingHref.join(', ')}` : '',
      lingeringHref.length ? `old link still present ${lingeringHref.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('; ')
    report(ok, `${status} ${e.paths[0]}${detail ? `  — ${detail}` : ''}`)
    for (const s of missing)
      console.log(`       missing: ${s.slice(0, 90)}${s.length > 90 ? '…' : ''}`)
  }

  if (email && password) {
    checkCanary(deployment.environment, email)
    client.login(email, password)
    for (const c of plan.changes) {
      const names = matchValues(c)
      const query = new URLSearchParams({ depth: '0', limit: '2' })
      names.forEach((n, i) => query.set(`where[or][${i}][${c.match.field}][equals]`, n))
      const found = client.api(`/api/${c.collection}?${query}`)
      const doc = found.docs?.[0]
      const versions = doc
        ? client.api(`/api/${c.collection}/versions?where[parent][equals]=${doc.id}&limit=1`)
        : { totalDocs: 0 }
      const ok = found.totalDocs === 1 && versions.totalDocs >= 1
      results.push({
        api: `${c.collection}/${c.match.value}`,
        ok,
        id: doc?.id,
        [c.match.field]: doc?.[c.match.field],
        versions: versions.totalDocs,
      })
      report(
        ok,
        `api ${c.collection}/${c.match.value} → id=${doc?.id ?? '?'} ${c.match.field}=${JSON.stringify(doc?.[c.match.field])} versions=${versions.totalDocs}`,
      )
    }
  } else {
    console.log('(no MHG_CMS_EMAIL/PASSWORD — page checks only, API and version checks skipped)')
  }
} finally {
  client.dispose()
  const out = join(dirname(planFile), 'verification.json')
  writeFileSync(
    out,
    JSON.stringify(
      { ...deployment, plan: plan.name, checkedAt: new Date().toISOString(), failed, results },
      null,
      2,
    ),
    { mode: 0o600 },
  )
  console.log(failed ? `\n${failed} check(s) FAILED → ${out}` : `\nall checks passed → ${out}`)
  process.exitCode = failed ? 1 : 0
}
