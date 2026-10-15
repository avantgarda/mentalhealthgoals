/** Reviewed API writes shared by the low-level patcher and the user handoff.
 * No connection to a production database, and no task-specific content. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

import { formatFileSize } from '../../src/utilities/fileLabel'
import type { CmsClient, Deployment } from './cms-client'
import { linkedMediaIds, readUploadFile, sha256, type MediaFile } from './content-plan'
import {
  assessChange,
  isMediaReference,
  isUnpublishedDraft,
  matchValues,
  resolveReferences,
  sameDocument,
  validatePlan,
  type ContentChange,
  type ContentPlan,
  type MediaUpload,
  type PartnerCreation,
} from './content-patch-core'

type Doc = Record<string, unknown> & { id: number | string; updatedAt: string }
type Write = {
  collection: string
  target: string
  id?: number | string
  status: 'in flight' | 'uploaded' | 'written' | 'verified'
  updatedAt?: string
  /** The name Media gave an upload, when not the one requested. */
  savedAs?: string
}
export type PatchOptions = {
  apply: boolean
  allowProduction?: boolean
  reverse?: boolean
  backupDir?: string
  /** Where the plan's files to upload are, relative paths resolving here. */
  planDir?: string
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

/** The files in Media with these IDs, as the deployment has them. Media is
 * publicly readable — the site serves the files — so this needs no login. */
export function readMedia(client: CmsClient, ids: (number | string)[]): MediaFile[] {
  if (!ids.length) return []
  const query = new URLSearchParams({
    depth: '0',
    limit: String(ids.length),
    'where[id][in]': ids.join(','),
  })
  return client.api(`/api/media?${query}`).docs ?? []
}

/** Every row ID (`id` strings) in a field value, at any depth. */
function rowIds(value: unknown): string[] {
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, item]) =>
    key === 'id' && typeof item === 'string' ? [item] : rowIds(item),
  )
}

/** The plan as the checks after a run read it — the record as it then stands.
 * A reversal tolerates new IDs on both sides while it runs: the rows the
 * forward plan added (gone once it is written) and the rows it restores. Only
 * the restored rows remain, so the checks get only their IDs; the others sit
 * in `before`, where validatePlan rightly refuses generated IDs. Only for a
 * plan written for content:verify: a dry run's plan keeps the full tolerance. */
export function settled(plan: ContentPlan): ContentPlan {
  return {
    ...plan,
    changes: plan.changes.map(({ generatedIds, ...change }) => {
      const before = new Set(rowIds(change.before))
      const restored = (generatedIds ?? []).filter((id) => !before.has(id))
      return restored.length ? { ...change, generatedIds: restored } : change
    }),
  }
}

/** Where Media serves a file. */
export const mediaFilePath = (filename: string) => `/api/media/file/${encodeURIComponent(filename)}`

function readMediaByFilename(client: CmsClient, filename: string): MediaFile | undefined {
  const query = new URLSearchParams({
    depth: '0',
    limit: '2',
    'where[filename][equals]': filename,
  })
  const result = client.api(`/api/media?${query}`)
  if (result.totalDocs > 1) throw new Error(`Several files in Media named ${filename}`)
  return result.totalDocs ? result.docs?.[0] : undefined
}

/** A file in Media is the reviewed upload only if it is the same bytes. The
 * record's type and size are checked first; the bytes are then downloaded and
 * hashed. A record of the reviewed size whose download fails — a 204, an HTTP
 * error, or a body cut short (curl exits 18) — is `unserved`: not yet served,
 * or a storage fault, never a different file, which would send the editor to
 * upload a second copy under another name. A download that arrives in full at
 * another size than the record's is a different file at that address — most
 * often a stale cached copy of an earlier file of the same name — and is
 * reported as `served`. */
function compareFile(
  client: CmsClient,
  file: MediaFile,
  upload: MediaUpload,
): { same: boolean; unserved?: string; served?: string } {
  if (file.mimeType !== upload.mimeType || file.filesize !== upload.filesize) return { same: false }
  let bytes: Buffer
  try {
    bytes = client.download(mediaFilePath(upload.filename))
  } catch (error) {
    return { same: false, unserved: (error as Error).message }
  }
  if (bytes.length !== file.filesize)
    return { same: false, served: `${bytes.length} bytes, where the record says ${file.filesize}` }
  return { same: sha256(bytes) === upload.sha256 }
}

export type UploadState = {
  upload: MediaUpload
  /** The file already in Media under this name: the same bytes, so reused. */
  doc?: MediaFile
  /** The local file, read only when it still has to be uploaded. */
  bytes?: Buffer
}

/**
 * Where each of a plan's files stands: already in Media (the same bytes,
 * reused) or ready to upload (the reviewed local file). Refuses a different
 * file under the same name, and a reversal without the file, before anything
 * is written. Media is publicly readable, so this works before login too.
 */
export function assessUploads(
  client: CmsClient,
  plan: ContentPlan,
  options: { planDir?: string; reverse?: boolean; log?: (message: string) => void } = {},
): UploadState[] {
  const log = options.log ?? console.log
  return (plan.uploadMedia ?? []).map((upload) => {
    const doc = readMediaByFilename(client, upload.filename)
    const label = `media/${upload.filename}`
    if (doc) {
      const check =
        upload.id !== undefined && doc.id !== upload.id
          ? { same: false }
          : compareFile(client, doc, upload)
      if (check.unserved)
        throw new Error(
          `Media lists ${upload.filename} (#${doc.id}) at the reviewed size but did not serve ` +
            `it in full (${check.unserved}). Nothing was written. Run the same command again ` +
            'in a minute; do not upload it under another name.',
        )
      if (check.served)
        throw new Error(
          `Media lists ${upload.filename} (#${doc.id}) at the reviewed size, but its address ` +
            `serves a different file (${check.served}): most likely a stale cached copy of an ` +
            'earlier file of that name. Nothing was written. Upload it under a new filename.',
        )
      if (!check.same)
        throw new Error(
          `A different file named ${upload.filename} is already in Media (#${doc.id}). ` +
            'Nothing was written. Choose another filename, or link to that file instead.',
        )
      if (doc.alt !== upload.alt)
        log(`note: ${label} keeps the alt text it has in Media, not the plan's`)
      log(`already in Media: ${label} (#${doc.id}), the reviewed file`)
      return { upload, doc }
    }
    if (upload.id !== undefined || options.reverse)
      throw new Error(`Uploaded file is missing from Media: ${upload.filename}`)
    if (!options.planDir) throw new Error(`No plan directory to upload ${upload.filename} from`)
    const bytes = readUploadFile(options.planDir, upload)
    log(`ready to upload: ${label} (${formatFileSize(upload.filesize)}) from ${upload.file}`)
    return { upload, bytes }
  })
}

/** Every file a plan links to must still be in Media, and a PDF: a deleted one
 * would leave the link's words with no link, and nothing else would notice.
 * A file the run has yet to upload is checked once it is uploaded. */
function checkLinkedMedia(client: CmsClient, plan: ContentPlan, log: (message: string) => void) {
  const ids = linkedMediaIds(plan.changes.map((change) => change.after)).filter(
    (id) => !isMediaReference(id),
  )
  const files = readMedia(client, ids)
  for (const id of ids) {
    const file = files.find((f) => String(f.id) === String(id))
    if (!file)
      throw new Error(
        `Linked file is missing from Media: #${id}. Rebuild the plan from a fresh snapshot.`,
      )
    if (file.mimeType !== 'application/pdf')
      throw new Error(`Linked file is not a PDF: media/${file.filename} (#${id})`)
    log(`file found: media/${file.filename} (#${id})`)
  }
}

/** Check all targets before the first content write. Return the numeric,
 * resolved plan, including corrected names on reruns. After an apply it is
 * `settled`, for verification; a dry run returns it as it was checked, so the
 * caller can still tell a change not yet applied from a differing baseline. */
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
  const uploads = assessUploads(client, template, {
    planDir: options.planDir,
    reverse: options.reverse,
    log,
  })
  const partners = (template.createPartners ?? []).map((partner) => ({
    partner,
    doc: readPartner(client, partner),
  }))
  const ids = new Map<string, number | string>()
  for (const { upload, doc } of uploads) if (doc) ids.set(upload.reference, doc.id)
  for (const { partner, doc } of partners) {
    if (doc) ids.set(partner.reference, doc.id)
    else if (options.reverse)
      throw new Error(`Cannot reverse without existing partner: ${partner.data.name}`)
    log(`${doc ? 'already exists' : 'ready to create'}: partners/${partner.data.name}`)
  }
  const resolvedPlan = () => {
    const resolved = resolveReferences(template, ids)
    if (options.reverse)
      resolved.changes = resolved.changes.map((change) => {
        // Rows the plan removed come back on reversal, and Payload gives a row
        // re-inserted under an ID the record no longer holds a new one, just
        // as it may for the rows a plan adds. Their IDs are tolerated like
        // generatedIds; the rows' content is still compared in full.
        const kept = new Set(rowIds(change.after))
        const restored = rowIds(change.before).filter((id) => !kept.has(id))
        const generatedIds = [...new Set([...(change.generatedIds ?? []), ...restored])]
        return {
          ...change,
          match: {
            ...change.match,
            value: String(change.after[change.match.field] ?? change.match.value),
          },
          before: change.after,
          after: change.before,
          ...(generatedIds.length ? { generatedIds } : {}),
        }
      })
    return resolved
  }
  let plan = resolvedPlan()
  checkLinkedMedia(client, plan, log)
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
    uploads: uploads.map(({ upload, doc }) => ({ ...upload, existing: doc?.id ?? null })),
    writes: [] as Write[],
  }
  const save = () => writeFileSync(backupFile, JSON.stringify(receipt, null, 2), { mode: 0o600 })
  save()
  log(`Backup: ${backupFile}`)
  try {
    // Files first: nothing links to one until it is in Media, verified byte
    // for byte. A lost response is recovered on rerun by the same comparison.
    for (const { upload, bytes, doc } of uploads) {
      if (doc || options.reverse) continue
      if (readMediaByFilename(client, upload.filename))
        throw new Error(`Media changed during this run: ${upload.filename}`)
      const write: Write = { collection: 'media', target: upload.filename, status: 'in flight' }
      receipt.writes.push(write)
      save()
      let result
      try {
        result = client.upload(
          '/api/media?depth=0',
          { bytes: bytes!, filename: upload.filename, mimeType: upload.mimeType },
          { alt: upload.alt },
        )
      } catch (error) {
        throw new Error(
          `Upload of ${upload.filename} failed or lost its response: ${(error as Error).message} ` +
            'Look for the file in Media before retrying; a rerun reuses it if it landed.',
        )
      }
      if (!result.doc?.id)
        throw new Error('Upload returned no record; inspect the receipt and Media before retrying')
      write.id = result.doc.id
      write.status = 'uploaded'
      if (result.doc.filename !== upload.filename) {
        write.savedAs = result.doc.filename
        save()
        throw new Error(
          `Media saved ${upload.filename} as ${result.doc.filename}: another file took the name ` +
            'during this run. Inspect Media before retrying.',
        )
      }
      save()
      const saved = readMediaByFilename(client, upload.filename)
      const check =
        saved && saved.id === write.id ? compareFile(client, saved, upload) : { same: false }
      if (check.unserved)
        throw new Error(
          `Upload read-back failed: ${upload.filename} is in Media (#${write.id}) but was not ` +
            `served in full yet (${check.unserved}). Nothing links to it. Run the same command ` +
            'again in a minute: it reuses the file once Media serves it.',
        )
      if (check.served)
        throw new Error(
          `Upload read-back failed: ${upload.filename} is in Media (#${write.id}) but its ` +
            `address serves a different file (${check.served}): most likely a stale cached ` +
            'copy of an earlier file of that name. Nothing links to it. Upload it under a new filename.',
        )
      if (!saved || !check.same)
        throw new Error(
          `Upload read-back failed: ${upload.filename} (#${write.id}) in Media is not the ` +
            'reviewed file. Nothing links to it; inspect it in Media before retrying.',
        )
      ids.set(upload.reference, saved.id)
      write.status = 'verified'
      save()
      log(`Verified upload: media/${upload.filename} (#${saved.id})`)
    }
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
    // Creations have been resolved. Reversal never deletes partners or files.
    delete plan.createPartners
    // Validated as reviewed — forwards, with its references resolved. A
    // reversal swaps before and after, so the rows a plan added (its
    // generatedIds) become rows it removes, which the forward rule rejects.
    const reviewed = resolveReferences(template, ids)
    delete reviewed.createPartners
    validatePlan(reviewed)
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
    return settled(plan)
  } catch (error) {
    receipt.state = 'stopped; inspect writes before retrying'
    save()
    throw error
  }
}
