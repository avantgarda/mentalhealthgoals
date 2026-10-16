// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { buildConfig, createLocalReq, getPayload, handleEndpoints, type Payload } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Users } from '@/collections/Users'
import { inviteUser, resendInvitation } from '@/collections/Users/invitations'
import type { User } from '@/payload-types'
import { up, down } from '@/migrations/20261015_220000_user_invitations'

const database = process.env.AUTH_TEST_DATABASE_URL
// Explicit opt-in; never use DATABASE_URL, which may point at production.
if (database) {
  const url = new URL(database)
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/mhg_auth_test')
    throw new Error('Auth tests require an isolated local mhg_auth_test database.')
}
const suite = database ? describe : describe.skip
suite('real Payload invitation and password lifecycle', () => {
  let payload: Payload
  let admin: User
  let normal: User
  let failEmail = false
  const messages: { html: string; to: unknown }[] = []
  const email = () => `${randomUUID()}@example.test`
  const password = 'A-long-test-password-47!'
  const newUser = (role: User['role'] = 'editor') =>
    payload.create({ collection: 'users', data: { email: email(), password, role } })
  const req = async (user: User | null, body?: unknown, id?: number) => {
    const request = await createLocalReq(
      { user: user ? { ...user, collection: 'users' } : undefined },
      payload,
    )
    request.json = async () => body
    request.routeParams = id ? { id: String(id) } : {}
    return request
  }
  const invite = async (body: unknown, user: User | null = admin) =>
    inviteUser.handler(await req(user, body))
  const resend = async (id: number, user: User | null = admin) =>
    resendInvitation.handler(await req(user, undefined, id))
  const token = (index = messages.length - 1) =>
    messages[index].html.match(/\/reset\/([^"<]+)/)?.[1] as string
  const reset = (value: string, nextPassword = password) =>
    payload.resetPassword({
      collection: 'users',
      data: { token: value, password: nextPassword },
      overrideAccess: false,
    })
  const freshInvite = async () => {
    const address = email()
    const response = await invite({ email: address, name: 'Test invitee', role: 'editor' })
    expect(response.status).toBe(200)
    const body = await response.json()
    return { id: body.userId as number, email: address, token: token() }
  }
  const clearThrottle = (id: number) =>
    payload.db.updateOne({ collection: 'users', id, data: { resetPasswordRequestedAt: null } })

  beforeAll(async () => {
    payload = await getPayload({
      config: await buildConfig({
        secret: 'test-only-secret-not-for-any-deployed-environment',
        serverURL: 'http://localhost:3000',
        csrf: ['http://localhost:3000'],
        admin: { user: 'users' },
        collections: [Users],
        db: postgresAdapter({ pool: { connectionString: database, max: 12 }, push: true }),
        email: () => ({
          name: 'capture',
          defaultFromAddress: 'test@example.test',
          defaultFromName: 'Test',
          sendEmail: async (message) => {
            if (failEmail) throw new Error('Simulated provider outage')
            messages.push({ html: String(message.html), to: message.to })
            return { id: randomUUID() }
          },
        }),
        telemetry: false,
      }),
    })
    admin = await newUser('admin')
    normal = await newUser()
  }, 60000)
  afterAll(async () => {
    await payload?.destroy()
  })

  it('migration preserves existing users and is reversible', async () => {
    const args = { db: payload.db.drizzle, payload, req: await req(admin) }
    await down(args)
    await up(args)
    expect((await payload.findByID({ collection: 'users', id: admin.id })).invitationPending).toBe(
      false,
    )
    expect(
      (await payload.login({ collection: 'users', data: { email: admin.email, password } })).user
        ?.id,
    ).toBe(admin.id)
  })
  it('rejects unauthenticated and non-admin creation/resends', async () => {
    for (const user of [null, normal]) {
      expect((await invite({ email: email(), name: 'No', role: 'admin' }, user)).status).toBe(403)
      expect((await resend(admin.id, user)).status).toBe(403)
    }
  })
  it('rejects invalid input and unknown roles', async () => {
    for (const body of [
      null,
      {},
      { name: 'X', email: 'bad', role: 'editor' },
      { name: 'X', email: email(), role: 'superuser' },
    ])
      expect((await invite(body)).status).toBe(400)
  })
  it('creates pending users with a secret password and normalises email', async () => {
    const address = email()
    const response = await invite({
      email: ` ${address.toUpperCase()} `,
      name: '<script>Test</script>',
      role: 'editor',
      password: 'attacker',
      invitationPending: false,
    })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.token).toBeUndefined()
    const user = await payload.findByID({ collection: 'users', id: body.userId })
    expect(user.email).toBe(address)
    expect(user.invitationPending).toBe(true)
    expect(messages.at(-1)?.html).toContain('&lt;script&gt;Test&lt;/script&gt;')
    expect(messages.at(-1)?.html).toContain('Set your password')
    expect(messages.at(-1)?.to).toBe(address)
    await expect(
      payload.login({ collection: 'users', data: { email: address, password: 'attacker' } }),
    ).rejects.toThrow()
  })
  it('activates through native reset and supports normal password login', async () => {
    const invited = await freshInvite()
    const result = await reset(invited.token)
    expect(result.user?.invitationPending).toBe(false)
    const login = await payload.login({
      collection: 'users',
      data: { email: invited.email, password },
    })
    expect(login.user?.id).toBe(invited.id)
    await expect(reset(invited.token)).rejects.toThrow(/invalid|expired/i)
    expect((await resend(invited.id)).status).toBe(409)
  })
  it('rejects expired and malformed tokens without activating the account', async () => {
    const invited = await freshInvite()
    await payload.db.updateOne({
      collection: 'users',
      id: invited.id,
      data: { resetPasswordExpiration: new Date(Date.now() - 1000).toISOString() },
    })
    await expect(reset(invited.token)).rejects.toThrow(/invalid|expired/i)
    await expect(reset('not-a-token')).rejects.toThrow()
    expect(
      (await payload.findByID({ collection: 'users', id: invited.id })).invitationPending,
    ).toBe(true)
  })
  it('retains pending accounts on email failure, then allows a successful retry', async () => {
    failEmail = true
    const address = email()
    let response: Response
    try {
      response = await invite({ name: 'Failed email', email: address, role: 'editor' })
    } finally {
      failEmail = false
    }
    expect(response!.status).toBe(502)
    const body = await response!.json()
    expect(
      (await payload.findByID({ collection: 'users', id: body.userId })).invitationPending,
    ).toBe(true)
    expect((await resend(body.userId)).status).toBe(200)
    expect((await reset(token())).user?.id).toBe(body.userId)
  })
  it('throttles sends and invalidates old links on successful resend', async () => {
    const invited = await freshInvite()
    const count = messages.length
    expect((await resend(invited.id)).status).toBe(429)
    expect(messages).toHaveLength(count)
    await clearThrottle(invited.id)
    expect((await resend(invited.id)).status).toBe(200)
    const next = token()
    expect(next).not.toBe(invited.token)
    await expect(reset(invited.token)).rejects.toThrow()
    await expect(reset(next)).resolves.toHaveProperty('user.id', invited.id)
  })
  it('keeps the previous link valid if a resend fails', async () => {
    const invited = await freshInvite()
    await clearThrottle(invited.id)
    failEmail = true
    try {
      expect((await resend(invited.id)).status).toBe(502)
    } finally {
      failEmail = false
    }
    await expect(reset(invited.token)).resolves.toHaveProperty('user.id', invited.id)
  })
  it('does not overwrite an existing account or its role', async () => {
    expect((await invite({ name: 'Overwrite', email: normal.email, role: 'admin' })).status).toBe(
      409,
    )
    expect((await payload.findByID({ collection: 'users', id: normal.id })).role).toBe('editor')
  })
  it('creates exactly one account for simultaneous duplicate submissions', async () => {
    const body = { name: 'Race', email: email(), role: 'editor' }
    const results = await Promise.all([invite(body), invite(body)])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    const found = await payload.find({
      collection: 'users',
      where: { email: { equals: body.email } },
    })
    expect(found.totalDocs).toBe(1)
  })
  it('allows only one simultaneous acceptance of the same reset token', async () => {
    const invited = await freshInvite()
    const results = await Promise.allSettled([
      reset(invited.token),
      reset(invited.token, 'Another-long-password-48!'),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
  })
  it('serializes simultaneous resend requests, sending only one email', async () => {
    const invited = await freshInvite()
    await clearThrottle(invited.id)
    const count = messages.length
    const results = await Promise.all([resend(invited.id), resend(invited.id)])
    expect(results.map((r) => r.status).sort()).toEqual([200, 429])
    expect(messages).toHaveLength(count + 1)
  })
  it('blocks pending login even if an admin manually assigns a password', async () => {
    const invited = await freshInvite()
    await payload.update({ collection: 'users', id: invited.id, data: { password } })
    await expect(
      payload.login({ collection: 'users', data: { email: invited.email, password } }),
    ).rejects.toThrow(/Set your password/)
  })
  it('prevents role and pending-status escalation through ordinary updates', async () => {
    const userRequest = await req(normal)
    const result = await payload.update({
      collection: 'users',
      id: normal.id,
      overrideAccess: false,
      req: userRequest,
      data: { role: 'admin', invitationPending: true },
    })
    expect(result.role).toBe('editor')
    expect(result.invitationPending).toBe(false)
  })
  it('recovers active accounts through the native forgot/reset flow', async () => {
    await payload.forgotPassword({ collection: 'users', data: { email: normal.email } })
    expect(messages.at(-1)?.html).toContain('Reset your password')
    const recovery = token()
    await expect(reset(recovery)).resolves.toHaveProperty('user.id', normal.id)
    await expect(reset(recovery)).rejects.toThrow()
  })
  it('enforces REST authentication/CSRF and delivers a usable invitation through HTTP', async () => {
    const post = (path: string, body: unknown, cookie = '', origin = 'http://localhost:3000') =>
      handleEndpoints({
        config: payload.config,
        request: new Request(`http://localhost:3000/api/users/${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
          body: JSON.stringify(body),
        }),
      })
    const login = await post('login', { email: admin.email, password })
    expect(login.status).toBe(200)
    const setCookie = login.headers.get('set-cookie')!
    expect(setCookie).toMatch(/httponly/i)
    const cookie = setCookie.split(';')[0]
    const body = { name: 'REST test', email: email(), role: 'editor' }
    expect((await post('invite', body)).status).toBe(403)
    expect((await post('invite', body, cookie, 'https://untrusted.example')).status).toBe(403)
    const created = await post('invite', body, cookie)
    expect(created.status).toBe(200)
    const result = await created.json()
    expect(result.token).toBeUndefined()
    const resetResponse = await post('reset-password', { token: token(), password })
    expect(resetResponse.status).toBe(200)
    expect((await resetResponse.json()).user.invitationPending).toBe(false)
    expect((await post(`${result.userId}/resend-invitation`, {}, cookie)).status).toBe(409)
    expect((await post('login', { email: body.email, password })).status).toBe(200)
  })
  it('handles reset racing with resend without leaving an active invitation', async () => {
    const invited = await freshInvite()
    await clearThrottle(invited.id)
    const [accept, send] = await Promise.allSettled([reset(invited.token), resend(invited.id)])
    if (accept.status === 'fulfilled') {
      expect(send.status).toBe('fulfilled')
      if (send.status === 'fulfilled') expect(send.value.status).toBe(409)
    } else {
      expect(send.status).toBe('fulfilled')
      if (send.status === 'fulfilled') expect(send.value.status).toBe(200)
      await expect(reset(token())).resolves.toHaveProperty('user.id', invited.id)
    }
    expect(
      (await payload.findByID({ collection: 'users', id: invited.id })).invitationPending,
    ).toBe(false)
  })
  it('does not activate an account when a Local API request is reused after a failed reset', async () => {
    const invited = await freshInvite()
    await payload.db.updateOne({
      collection: 'users',
      id: invited.id,
      data: { resetPasswordExpiration: new Date(Date.now() - 1000).toISOString() },
    })
    const reused = await req(admin)
    await expect(
      payload.resetPassword({
        collection: 'users',
        data: { token: invited.token, password },
        overrideAccess: false,
        req: reused,
      }),
    ).rejects.toThrow()
    const result = await payload.update({
      collection: 'users',
      id: invited.id,
      data: { name: 'Still pending' },
      req: reused,
    })
    expect(result.invitationPending).toBe(true)
  })
  it('does not send mail or expose a user for unknown recovery addresses', async () => {
    const count = messages.length
    expect(
      await payload.forgotPassword({ collection: 'users', data: { email: email() } }),
    ).toBeNull()
    expect(messages).toHaveLength(count)
  })
  it('restricts editor reads, bulk updates and unlocking to the intended account permissions', async () => {
    const userRequest = await req(normal)
    const visible = await payload.find({
      collection: 'users',
      overrideAccess: false,
      req: userRequest,
    })
    expect(visible.docs.map((user) => user.id)).toEqual([normal.id])
    await expect(
      payload.findByID({
        collection: 'users',
        id: admin.id,
        overrideAccess: false,
        req: userRequest,
      }),
    ).rejects.toThrow()
    const updated = await payload.update({
      collection: 'users',
      where: { id: { in: [admin.id, normal.id] } },
      data: { name: 'Self only' },
      overrideAccess: false,
      req: userRequest,
    })
    expect(updated.docs.map((user) => user.id)).toEqual([normal.id])
    await expect(
      payload.unlock({
        collection: 'users',
        data: { email: admin.email, password },
        overrideAccess: false,
        req: userRequest,
      }),
    ).rejects.toThrow()
    await expect(
      payload.unlock({
        collection: 'users',
        data: { email: normal.email, password },
        overrideAccess: false,
        req: await req(admin),
      }),
    ).resolves.toBeDefined()
  })
})
