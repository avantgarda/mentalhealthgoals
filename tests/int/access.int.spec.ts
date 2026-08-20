/**
 * Access-control integration tests against a real Payload + Postgres.
 * These pin the security model built during the 2026-08 audit: draft content
 * is invisible to the public (F08), and the admin/editor role split (F05)
 * actually holds at the API level. Creates its own fixtures and cleans up.
 */
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, afterAll, expect } from 'vitest'

let payload: Payload

const run = Date.now()
const bootstrapEmail = `test-bootstrap-${run}@test.local`
const editorEmail = `test-editor-${run}@test.local`
const adminEmail = `test-admin-${run}@test.local`
const draftSlug = `test-draft-${run}`
const publishedSlug = `test-published-${run}`

/* eslint-disable @typescript-eslint/no-explicit-any */
let editor: any
let admin: any

const minimalLayout = [{ blockType: 'content' as const, columns: [] }]

describe('access control', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })

    // On a fresh database (CI) the first-ever user is forcibly promoted to
    // admin by the Users beforeChange hook. Create a bootstrap user first to
    // absorb that rule, so the editor fixture below really is an editor.
    await payload.create({
      collection: 'users',
      data: { name: 'Bootstrap', email: bootstrapEmail, password: 'test-pass-1', role: 'admin' },
    })

    editor = await payload.create({
      collection: 'users',
      data: { name: 'Test Editor', email: editorEmail, password: 'test-pass-1', role: 'editor' },
    })
    if (editor.role !== 'editor') {
      throw new Error('Fixture setup failed: editor user was not created with the editor role')
    }
    admin = await payload.create({
      collection: 'users',
      data: { name: 'Test Admin', email: adminEmail, password: 'test-pass-1', role: 'admin' },
    })

    await payload.create({
      collection: 'pages',
      draft: true,
      context: { disableRevalidate: true },
      data: { title: 'Test Draft', slug: draftSlug, _status: 'draft', layout: minimalLayout },
    })

    const publishedPage = await payload.create({
      collection: 'pages',
      draft: true,
      context: { disableRevalidate: true },
      data: { title: 'Test Published', slug: publishedSlug, layout: minimalLayout },
    })
    await payload.update({
      collection: 'pages',
      id: publishedPage.id,
      context: { disableRevalidate: true },
      data: { _status: 'published' },
    })
  })

  afterAll(async () => {
    await payload.delete({
      collection: 'pages',
      where: { slug: { in: [draftSlug, publishedSlug] } },
      context: { disableRevalidate: true },
    })
    await payload.delete({
      collection: 'users',
      where: { email: { in: [bootstrapEmail, editorEmail, adminEmail] } },
    })
  })

  describe('public (anonymous) access', () => {
    it('cannot see draft pages (F08)', async () => {
      const res = await payload.find({
        collection: 'pages',
        overrideAccess: false,
        where: { slug: { equals: draftSlug } },
      })
      expect(res.docs).toHaveLength(0)
    })

    it('can see published pages', async () => {
      const res = await payload.find({
        collection: 'pages',
        overrideAccess: false,
        where: { slug: { equals: publishedSlug } },
      })
      expect(res.docs).toHaveLength(1)
    })

    it('can read workstreams and people, but not users', async () => {
      await expect(
        payload.find({ collection: 'workstreams', overrideAccess: false }),
      ).resolves.toBeDefined()
      await expect(
        payload.find({ collection: 'people', overrideAccess: false }),
      ).resolves.toBeDefined()

      await expect(payload.find({ collection: 'users', overrideAccess: false })).rejects.toThrow(
        /not allowed/i,
      )
    })
  })

  describe('editor role (F05)', () => {
    it('can see draft pages', async () => {
      const res = await payload.find({
        collection: 'pages',
        overrideAccess: false,
        user: editor,
        where: { slug: { equals: draftSlug } },
      })
      expect(res.docs).toHaveLength(1)
    })

    it('cannot create users', async () => {
      await expect(
        payload.create({
          collection: 'users',
          overrideAccess: false,
          user: editor,
          data: {
            name: 'Sneaky',
            email: `sneaky-${run}@test.local`,
            password: 'x-pass-123',
            role: 'admin',
          },
        }),
      ).rejects.toThrow()
    })

    it('cannot delete other users', async () => {
      await expect(
        payload.delete({
          collection: 'users',
          overrideAccess: false,
          user: editor,
          id: admin.id,
        }),
      ).rejects.toThrow()
    })

    it('cannot escalate their own role (field-level access)', async () => {
      const updated = await payload.update({
        collection: 'users',
        overrideAccess: false,
        user: editor,
        id: editor.id,
        data: { role: 'admin' },
      })
      expect(updated.role).toBe('editor')
    })
  })

  describe('admin role (F05)', () => {
    it('can create and delete users', async () => {
      const created = await payload.create({
        collection: 'users',
        overrideAccess: false,
        user: admin,
        data: {
          name: 'Temp',
          email: `temp-${run}@test.local`,
          password: 'x-pass-123',
          role: 'editor',
        },
      })
      expect(created.role).toBe('editor')

      await expect(
        payload.delete({
          collection: 'users',
          overrideAccess: false,
          user: admin,
          id: created.id,
        }),
      ).resolves.toBeDefined()
    })

    it('can grant roles', async () => {
      const updated = await payload.update({
        collection: 'users',
        overrideAccess: false,
        user: admin,
        id: editor.id,
        data: { role: 'admin' },
      })
      expect(updated.role).toBe('admin')

      // put it back for the other assertions' sake
      await payload.update({
        collection: 'users',
        id: editor.id,
        data: { role: 'editor' },
      })
    })
  })
})
