/** Reviewed API writes shared by the low-level patcher and the user handoff.
 * No connection to a production database, and no task-specific content. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

import type { CmsClient, Deployment } from './cms-client'
import {
  assessChange,
  isUnpublishedDraft,
  matchValues,
  resolvePartnerReferences,
  sameDocument,
  validatePlan,
  type ContentChange,
  type ContentPlan,
  type PartnerCreation,
} from './content-patch-core'

type Doc = Record<string, unknown> & { id: number | string; updatedAt: string }
type Write = {
  collection: string
  target: string
  id?: number | string
  status: 'in flight' | 'written' | 'verified'
  updatedAt?: string
}
export type PatchOptions = {
  apply: boolean
  allowProduction?: boolean
  reverse?: boolean
  backupDir?: string
  log?: (message: string) => void
}

export function readChange(client: CmsClient, change: ContentChange): Doc {
  const names = matchValues(change)
  const query = new URLSearchParams({ depth: '0', limit: '2', draft: 'true' })
  names.forEach((name, i) => query.set(`where[or][${i}][${change.match.field}][equals]`, name))
  const result = client.api(`/api/${change.collection}?${query}`)
  if (result.totalDocs !== 1 || result.docs?.length !== 1)
    throw new Error(`Expected exactly one ${change.collection}: ${names.join(' or ')}`)
  const doc = result.docs[0] as Doc
  if (isUnpublishedDraft(doc))
    throw new Error(`Unpublished draft needs review: ${change.match.value}`)
  if (!doc.id || typeof doc.updatedAt !== 'string')
    throw new Error('CMS record lacks a write fence')
  return doc
}

function readPartner(client: CmsClient, partner: PartnerCreation): Doc | undefined {
  const query = new URLSearchParams({
    depth: '0',
    limit: '2',
    'where[name][equals]': partner.data.name,
  })
  const result = client.api(`/api/partners?${query}`)
  if (result.totalDocs > 1) throw new Error(`Duplicate programme partners: ${partner.data.name}`)
  if (!result.totalDocs) return undefined
  const doc = result.docs?.[0] as Doc | undefined
  if (
    !doc?.id ||
    Object.entries(partner.data).some(([key, value]) => !isDeepStrictEqual(doc[key], value))
  )
    throw new Error(`Existing partner differs from reviewed identity: ${partner.data.name}`)
  return doc
}

/** Check all targets before the first content write. Return the numeric,
 * resolved plan for verification, including corrected names on reruns. */
export function runContentPatch(
  client: CmsClient,
  deployment: Deployment,
  input: ContentPlan,
  options: PatchOptions,
): ContentPlan {
  const template = validatePlan(input)
  const log = options.log ?? console.log
  if (deployment.environment === 'production' && options.apply && !options.allowProduction)
    throw new Error('Production writes require --allow-production after content approval')
  if (options.apply && !options.backupDir) throw new Error('Apply requires a backup directory')
  const partners = (template.createPartners ?? []).map((partner) => ({
    partner,
    doc: readPartner(client, partner),
  }))
  const ids = new Map<string, number | string>()
  for (const { partner, doc } of partners) {
    if (doc) ids.set(partner.reference, doc.id)
    else if (options.reverse)
      throw new Error(`Cannot reverse without existing partner: ${partner.data.name}`)
    log(`${doc ? 'already exists' : 'ready to create'}: partners/${partner.data.name}`)
  }
  const resolvedPlan = () => {
    const resolved = resolvePartnerReferences(template, ids)
    if (options.reverse)
      resolved.changes = resolved.changes.map((change) => ({
        ...change,
        match: {
          ...change.match,
          value: String(change.after[change.match.field] ?? change.match.value),
        },
        before: change.after,
        after: change.before,
      }))
    return resolved
  }
  let plan = resolvedPlan()
  const originals = plan.changes.map((change) => {
    const doc = readChange(client, change)
    const state = assessChange(doc, change)
    log(
      `${state}: ${change.collection}/${change.match.value} [${Object.keys(change.after).join(', ')}]`,
    )
    return { change, doc, state }
  })
  if (!options.apply) return plan

  const directory = resolve(options.backupDir!)
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const backupFile = join(directory, `content-backup-${Date.now()}.json`)
  const receipt = {
    ...deployment,
    planName: plan.name,
    createdAt: new Date().toISOString(),
    reverse: Boolean(options.reverse),
    state: 'applying',
    originals,
    partners,
    writes: [] as Write[],
  }
  const save = () => writeFileSync(backupFile, JSON.stringify(receipt, null, 2), { mode: 0o600 })
  save()
  log(`Backup: ${backupFile}`)
  try {
    // There is no cross-record transaction. Refuse duplicates before creation;
    // a lost response is recoverable by matching the reviewed identity on rerun.
    for (const { partner, doc } of partners) {
      if (doc || options.reverse) continue
      if (readPartner(client, partner))
        throw new Error(`Partner list changed during this run: ${partner.data.name}`)
      const write: Write = {
        collection: 'partners',
        target: partner.data.name,
        status: 'in flight',
      }
      receipt.writes.push(write)
      save()
      const result = client.api('/api/partners?depth=0', 'POST', partner.data)
      if (!result.doc?.id)
        throw new Error('Partner creation returned no record; inspect the receipt before retrying')
      write.id = result.doc.id
      write.status = 'written'
      save()
      const saved = readPartner(client, partner)
      if (!saved || saved.id !== write.id)
        throw new Error(`Partner read-back failed: ${partner.data.name}`)
      ids.set(partner.reference, saved.id)
      write.status = 'verified'
      write.updatedAt = saved.updatedAt
      save()
      log(`Verified new partner: ${partner.data.name} (${saved.id})`)
    }
    plan = resolvedPlan()
    // Creations have been resolved. Reversal never deletes partner records.
    delete plan.createPartners
    validatePlan(plan)
    for (let i = 0; i < plan.changes.length; i++) {
      const change = plan.changes[i]
      const original = originals[i]
      if (original.state === 'already applied') continue
      const current = readChange(client, change)
      if (
        current.id !== original.doc.id ||
        current.updatedAt !== original.doc.updatedAt ||
        !sameDocument(current, original.doc)
      )
        throw new Error(`Content changed during this run: ${change.match.value}`)
      assessChange(current, change)
      const write: Write = {
        collection: change.collection,
        target: change.match.value,
        id: current.id,
        status: 'in flight',
        updatedAt: current.updatedAt,
      }
      receipt.writes.push(write)
      save()
      const query = new URLSearchParams({
        'where[and][0][id][equals]': String(current.id),
        'where[and][1][updatedAt][equals]': current.updatedAt,
        depth: '0',
      })
      const result = client.api(`/api/${change.collection}?${query}`, 'PATCH', change.after)
      if (result.errors?.length || result.docs?.length !== 1)
        throw new Error(
          `Update failed or concurrent change detected: ${change.match.value}. Inspect backup before retrying.`,
        )
      write.status = 'written'
      save()
      const saved = readChange(client, change)
      if (assessChange(saved, change) !== 'already applied')
        throw new Error(`Read-back verification failed: ${change.match.value}`)
      write.status = 'verified'
      write.updatedAt = saved.updatedAt
      save()
      log(`Verified: ${change.collection}/${change.match.value}`)
    }
    receipt.state = 'applied'
    save()
    return plan
  } catch (error) {
    receipt.state = 'stopped; inspect writes before retrying'
    save()
    throw error
  }
}
