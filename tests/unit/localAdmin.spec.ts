import { describe, expect, it } from 'vitest'

import { readSeedAdmin, refuseTarget } from '../../scripts/lib/local-admin'

/**
 * The account `pnpm local:admin` creates after `pnpm sync:db`. A copy of
 * production has no users by design, so without this every re-sync means
 * making a local login again.
 */
describe('readSeedAdmin', () => {
  it('reads both settings', () => {
    expect(
      readSeedAdmin({
        SEED_ADMIN_EMAIL: 'admin@localhost.invalid',
        SEED_ADMIN_PASSWORD: 'local-only',
      }),
    ).toEqual({ ok: true, admin: { email: 'admin@localhost.invalid', password: 'local-only' } })
  })

  it('lower-cases and trims the address, as Payload stores it', () => {
    const result = readSeedAdmin({
      SEED_ADMIN_EMAIL: '  Admin@Example.COM ',
      SEED_ADMIN_PASSWORD: 'x',
    })
    expect(result).toEqual({ ok: true, admin: { email: 'admin@example.com', password: 'x' } })
  })

  it('keeps the password exactly as written', () => {
    const result = readSeedAdmin({
      SEED_ADMIN_EMAIL: 'a@b.c',
      SEED_ADMIN_PASSWORD: ' spaced pass ',
    })
    expect(result.ok && result.admin.password).toBe(' spaced pass ')
  })

  it('says which setting is missing', () => {
    expect(readSeedAdmin({})).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/are not set/),
    })
    expect(readSeedAdmin({ SEED_ADMIN_PASSWORD: 'x' })).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/^SEED_ADMIN_EMAIL/),
    })
    expect(readSeedAdmin({ SEED_ADMIN_EMAIL: 'a@b.c', SEED_ADMIN_PASSWORD: '' })).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/^SEED_ADMIN_PASSWORD/),
    })
  })

  it('refuses something that is not an email address', () => {
    expect(readSeedAdmin({ SEED_ADMIN_EMAIL: 'admin', SEED_ADMIN_PASSWORD: 'x' })).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/not an email address/),
    })
  })
})

describe('refuseTarget', () => {
  it('allows a database on this machine', () => {
    expect(refuseTarget('postgresql://localhost:5432/mentalhealthgoals')).toBeNull()
    expect(refuseTarget('postgresql://127.0.0.1:5432/mhg_rehearsal')).toBeNull()
  })

  it('refuses anything else, and an unset DATABASE_URL', () => {
    expect(
      refuseTarget('postgresql://owner:secret@ep-example.eu-west-2.aws.neon.tech/neondb'),
    ).toMatch(/"ep-example\.eu-west-2\.aws\.neon\.tech", not a database on this machine/)
    expect(refuseTarget(undefined)).toMatch(/DATABASE_URL is not set/)
  })
})
