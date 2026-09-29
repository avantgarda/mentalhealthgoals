/**
 * A workstream's leads are chosen from the people linked to it. The workstream
 * page lists its leads, and each person's Team card names the workstreams they
 * are linked to, so a lead who was not linked would lead a workstream their own
 * card never mentions. Creates its own records and removes them.
 */
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, afterAll, expect } from 'vitest'

let payload: Payload

const run = Date.now()
const context = { disableRevalidate: true }

let workstreamId: number
let linkedId: number
let unlinkedId: number

describe('workstream leads', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })

    const workstream = await payload.create({
      collection: 'workstreams',
      context,
      data: {
        number: 90,
        title: `Test Workstream ${run}`,
        slug: `test-workstream-${run}`,
        summary: 'A workstream for the leads test.',
        deliveredBy: 'Test University',
      },
    })
    workstreamId = workstream.id

    const person = (name: string, workstreams: number[]) =>
      payload.create({
        collection: 'people',
        context,
        data: { name, role: 'Tester', organisation: 'Test University', workstreams },
      })
    linkedId = (await person(`Linked ${run}`, [workstreamId])).id
    unlinkedId = (await person(`Unlinked ${run}`, [])).id
  })

  afterAll(async () => {
    for (const id of [linkedId, unlinkedId].filter(Boolean)) {
      await payload.delete({ collection: 'people', id, context })
    }
    if (workstreamId) await payload.delete({ collection: 'workstreams', id: workstreamId, context })
  })

  it('accepts a lead who is linked to the workstream', async () => {
    const updated = await payload.update({
      collection: 'workstreams',
      id: workstreamId,
      depth: 0,
      context,
      data: { leads: [linkedId] },
    })
    expect(updated.leads).toEqual([linkedId])
  })

  it('refuses a lead who is not linked to the workstream', async () => {
    await expect(
      payload.update({
        collection: 'workstreams',
        id: workstreamId,
        depth: 0,
        context,
        data: { leads: [linkedId, unlinkedId] },
      }),
    ).rejects.toThrow(/leads/i)
  })
})
