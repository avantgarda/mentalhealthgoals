/**
 * Prove a deployment shows what a plan says it should — after applying, on
 * preview and again on production.
 *
 *   MHG_CMS_EMAIL=… MHG_CMS_PASSWORD=… pnpm content:verify \
 *     --deployment <host>.vercel.app --plan temp/<plan-name>/plan.json
 *
 * Every expectation is derived from the plan itself: text that appears in a
 * record's revised fields must be visible on its page, a page's SEO title and
 * description must sit in the document head, long passages that were removed
 * must be gone, links that moved must have moved, and a record whose
 * slug changed must answer at the new path and 404 at the old one. A file the
 * plan uploaded must be in Media under its name and served with the reviewed
 * type and size. With a login
 * it also confirms each record is found under its new name and carries a
 * version — the proof that the write went through Payload and is reversible.
 *
 * Results are written next to the plan as `verification.json`, recording what
 * was actually matched rather than a bare pass, so they can be read later
 * without being taken on trust.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { personAnchor } from '../src/utilities/personAnchor'
import { argument, createCmsClient, resolveDeployment } from './lib/cms-client'
import {
  assessChange,
  checkCanary,
  creationImages,
  isUnpublishedDraft,
  matchValues,
  validatePlan,
} from './lib/content-patch-core'
import {
  deriveExpectations,
  imagePlacements,
  headText,
  linkedMediaIds,
  visibleText,
  type HeadPassage,
  type MediaFile,
} from './lib/content-plan'
import { mediaFilePath, readMedia, readPerson } from './lib/content-patch-runner'

const args = process.argv.slice(2)
const deployment = resolveDeployment(argument(args, '--deployment'))
const planFile = argument(args, '--plan')
const plan = validatePlan(JSON.parse(readFileSync(planFile, 'utf8')))
if (plan.createPartners?.length)
  throw new Error(
    'Verify the resolved-plan.json produced by content:run for plans creating partners',
  )
if (plan.uploadMedia?.some((upload) => upload.id === undefined))
  throw new Error('Verify the resolved-plan.json produced by content:run for plans uploading files')
const { MHG_CMS_EMAIL: email, MHG_CMS_PASSWORD: password } = process.env

const client = createCmsClient(deployment.hostname)
const results: Record<string, unknown>[] = []
let failed = 0
let completed = false
const report = (ok: boolean, line: string) => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${line}`)
}
const tags = (html: string, tag: string) =>
  html.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'g')) ?? []
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? ''
const showsImage = (html: string, media: MediaFile, alt?: string) => {
  const filenames = [
    media.filename,
    ...Object.values(media.sizes ?? {}).map((size) => size?.filename),
  ]
  return (html.match(/<img\b[^>]*>/g) ?? []).some((tag) => {
    const src = attr(tag, 'src')
    return (
      filenames.some((filename) => filename && src.includes(encodeURIComponent(filename))) &&
      (alt === undefined || visibleText(attr(tag, 'alt')) === alt)
    )
  })
}

try {
  // A link to a file in Media renders with the file's type and size after its
  // words, so the page checks need the files as this deployment has them.
  const media = readMedia(client, linkedMediaIds(plan.changes.flatMap((c) => [c.before, c.after])))
  for (const id of linkedMediaIds(plan.changes.map((c) => c.after))) {
    const file = media.find((f) => String(f.id) === String(id))
    const ok = file?.mimeType === 'application/pdf'
    results.push({ media: id, ok, filename: file?.filename, mimeType: file?.mimeType })
    report(ok, `media #${id} → ${file ? `${file.filename} (${file.mimeType})` : 'missing'}`)
  }
  // Each uploaded file: its record, then the file as a reader gets it. One
  // byte is enough to read the type and the full size from the headers.
  const uploads = plan.uploadMedia ?? []
  const attached = creationImages(plan)
  const records = readMedia(
    client,
    uploads.map((upload) => upload.id!),
  )
  for (const upload of uploads) {
    const record = records.find((f) => String(f.id) === String(upload.id))
    const path = mediaFilePath(upload.filename)
    const served = client.probe(path)
    const contentType = served.headers['content-type']?.split(';')[0].trim()
    const size = Number(
      served.status === 206
        ? served.headers['content-range']?.match(/\/(\d+)$/)?.[1]
        : served.headers['content-length'],
    )
    const ok =
      record?.filename === upload.filename &&
      record.mimeType === upload.mimeType &&
      record.filesize === upload.filesize &&
      (!attached.has(upload.id!) || record.alt === upload.alt) &&
      (served.status === 206 || served.status === 200) &&
      contentType === upload.mimeType &&
      size === upload.filesize
    results.push({
      upload: upload.filename,
      ok,
      id: upload.id,
      record: record
        ? { filename: record.filename, mimeType: record.mimeType, filesize: record.filesize }
        : null,
      status: served.status,
      contentType,
      size,
      expectSize: upload.filesize,
    })
    report(
      ok,
      `${served.status} ${path} → ${contentType ?? '?'}, ${Number.isFinite(size) ? size : '?'} bytes` +
        (ok ? '' : `  — want media #${upload.id}, ${upload.mimeType}, ${upload.filesize} bytes`),
    )
  }
  if (plan.createPeople?.length) {
    const page = client.page('/people')
    const cards = tags(page.html, 'li')
    for (const person of plan.createPeople) {
      const { name, role, organisation, photo } = person.data
      const matches = cards.filter((card) => attr(card.split('>')[0], 'id') === personAnchor(name))
      const card = matches[0] ?? ''
      const renderedName = card.match(/<span data-person-name[^>]*>([\s\S]*?)<\/span>/)?.[1]
      const file = records.find((record) => record.id === photo)
      const alt = uploads.find((upload) => upload.id === photo)?.alt
      const doc = readPerson(client, person)
      const ok =
        !!doc &&
        page.status === 200 &&
        matches.length === 1 &&
        visibleText(renderedName ?? '') === name &&
        tags(card, 'p').some((p) => visibleText(p).trim() === role) &&
        tags(card, 'p').some((p) => visibleText(p).trim() === organisation) &&
        !!file &&
        showsImage(card, file, alt)
      results.push({ path: '/people', person: name, id: doc?.id, photo, ok })
      report(ok, `Team profile and headshot — ${name}`)
    }
  }
  for (const change of plan.changes) {
    if (change.collection !== 'workstreams' || !Array.isArray(change.after.leadPartners)) continue
    const lead = change.after.leadPartners as number[]
    const delivery = (change.after.partners as number[] | undefined)?.filter(
      (id) => !lead.includes(id),
    )
    const ids = [...new Set([...lead, ...(delivery ?? [])])]
    const query = new URLSearchParams({
      depth: '1',
      limit: String(ids.length),
      'where[id][in]': ids.join(','),
    })
    const partners = ids.length
      ? (client.api(`/api/partners?${query}`).docs as {
          id: number
          name: string
          url?: string | null
          logo?: MediaFile | null
        }[])
      : []
    const path = `/workstreams/${change.after.slug ?? change.match.value}`
    const page = client.page(path)
    for (const [label, groupIds] of [
      ['led-by', lead],
      ['delivered-with', delivery],
    ] as const) {
      if (!groupIds) continue
      const group = tags(page.html, 'ul').find(
        (list) => attr(list.split('>')[0], 'aria-labelledby') === `partners-${label}`,
      )
      const items = group ? tags(group, 'li') : []
      const ok =
        page.status === 200 &&
        items.length === groupIds.length &&
        groupIds.every((id) => {
          const partner = partners.find((doc) => doc.id === id)
          if (!partner) return false
          const index = items.findIndex(
            (item) =>
              (!partner.url ||
                tags(item, 'a').some(
                  (a) => visibleText(attr(a.split('>')[0], 'href')) === partner.url,
                )) &&
              (partner.logo
                ? showsImage(item, partner.logo)
                : visibleText(item).includes(partner.name)),
          )
          if (index < 0) return false
          items.splice(index, 1)
          return true
        })
      results.push({ path, partners: groupIds, group: label, ok })
      report(ok, `${path} partner row — ${label}`)
    }
  }
  for (const change of plan.changes) {
    const placements = imagePlacements(change)
    if (!placements.length) continue
    const slug = change.match.value === 'home' ? '' : change.match.value
    const path = change.collection === 'posts' ? `/posts/${slug}` : `/${slug}`
    const page = client.page(path)
    const images = page.html.match(/<img\b[^>]*>/g) ?? []
    for (const placement of placements) {
      const [file] = readMedia(client, [placement.id])
      const filename = file?.filename
      const ok =
        page.status === 200 &&
        Boolean(
          filename &&
          file?.mimeType?.startsWith('image/') &&
          images.some(
            (tag) => tag.includes(filename) || tag.includes(encodeURIComponent(filename)),
          ),
        )
      report(ok, `image ${path} ${placement.path} → ${filename ?? placement.id}`)
      results.push({ image: placement, path, filename, ok })
    }
  }
  for (const e of deriveExpectations(plan, { media })) {
    // A record's words may render on more than one page (a workstream's summary
    // sits on the index); a passage counts if any of them shows it, and an old
    // one must be gone from all of them. The status is the record's own page.
    const pages = e.paths.map((path) => ({ path, ...client.page(path) }))
    const status = pages[0].status
    const seen = pages.map((p) => visibleText(p.html))
    const heads = pages.map((p) => headText(p.html))
    const anyText = (s: string) => seen.some((t) => t.includes(s))
    const anyHref = (u: string) => pages.some((p) => p.html.includes(`href="${u}"`))
    // The title carries the site name after it, so both head fields are matched
    // by inclusion; an old value lingering there fails the same way.
    const anyHead = (h: HeadPassage) => heads.some((x) => x[h.head].includes(h.text))
    const missing = e.expectText.filter((s) => !anyText(s))
    const lingering = e.rejectText.filter(anyText)
    const missingHref = e.expectHref.filter((u) => !anyHref(u))
    const lingeringHref = e.rejectHref.filter(anyHref)
    const missingHead = e.expectHead.filter((h) => !anyHead(h))
    const lingeringHead = e.rejectHead.filter(anyHead)
    const ok =
      status === e.expectStatus &&
      !missing.length &&
      !lingering.length &&
      !missingHref.length &&
      !lingeringHref.length &&
      !missingHead.length &&
      !lingeringHead.length
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
      headFound: e.expectHead.filter(anyHead),
      missingHead,
      lingeringHead,
    })
    const detail = [
      status !== e.expectStatus ? `status ${status} (want ${e.expectStatus})` : '',
      missing.length ? `missing ${missing.length} passage(s)` : '',
      lingering.length ? `${lingering.length} old passage(s) still present` : '',
      missingHref.length ? `missing link ${missingHref.join(', ')}` : '',
      lingeringHref.length ? `old link still present ${lingeringHref.join(', ')}` : '',
      missingHead.length ? `missing head ${missingHead.map((h) => h.head).join(', ')}` : '',
      lingeringHead.length
        ? `old head ${lingeringHead.map((h) => h.head).join(', ')} still present`
        : '',
    ]
      .filter(Boolean)
      .join('; ')
    report(ok, `${status} ${e.paths[0]}${detail ? `  — ${detail}` : ''}`)
    for (const s of missing)
      console.log(`       missing: ${s.slice(0, 90)}${s.length > 90 ? '…' : ''}`)
    for (const h of missingHead)
      console.log(
        `       missing ${h.head}: ${h.text.slice(0, 90)}${h.text.length > 90 ? '…' : ''}`,
      )
  }

  if (email && password) {
    checkCanary(deployment.environment, email)
    client.login(email, password)
    for (const c of plan.changes) {
      const names = matchValues(c)
      const query = new URLSearchParams({ depth: '0', limit: '2', draft: 'true' })
      names.forEach((n, i) => query.set(`where[or][${i}][${c.match.field}][equals]`, n))
      const found = client.api(`/api/${c.collection}?${query}`)
      const doc = found.docs?.[0]
      const versions = doc
        ? client.api(`/api/${c.collection}/versions?where[parent][equals]=${doc.id}&limit=1`)
        : { totalDocs: 0 }
      const ok =
        found.totalDocs === 1 &&
        versions.totalDocs >= 1 &&
        doc &&
        !isUnpublishedDraft(doc) &&
        assessChange(doc, c) === 'already applied'
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
  completed = true
} finally {
  if (!completed) failed++
  client.dispose()
  const out = join(dirname(planFile), 'verification.json')
  writeFileSync(
    out,
    JSON.stringify(
      {
        ...deployment,
        plan: plan.name,
        checkedAt: new Date().toISOString(),
        completed,
        failed,
        results,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  )
  console.log(failed ? `\n${failed} check(s) FAILED → ${out}` : `\nall checks passed → ${out}`)
  process.exitCode = failed ? 1 : 0
}
