import { AuthEmailDisabledError } from '@/utilities/authEmailAdapter'
import type { User } from '@/payload-types'
import { randomBytes } from 'node:crypto'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import {
  APIError,
  type CollectionBeforeOperationHook,
  type CollectionBeforeValidateHook,
  type Endpoint,
  type PayloadRequest,
} from 'payload'

// Request identity cannot be supplied by REST/GraphQL clients.
const passwordResets = new WeakSet<PayloadRequest>()
const invitationRequests = new WeakSet<PayloadRequest>()

export const guardPasswordOperations: CollectionBeforeOperationHook = async ({
  operation,
  args,
  req,
}) => {
  // A trusted Local API caller can reuse a request after a failed reset. Never
  // carry its reset-only privilege into an ordinary collection operation.
  if (operation !== 'resetPassword') passwordResets.delete(req)
  if (operation !== 'forgotPassword' && operation !== 'resetPassword') return
  const data = args.data as { email?: string; token?: string }
  let email = data.email?.trim().toLowerCase()
  if (operation === 'resetPassword') {
    if (typeof data.token !== 'string' || !data.token)
      throw new APIError('Invalid reset link.', 400)
    const user = await req.payload.db.findOne<User>({
      collection: 'users',
      req,
      where: { resetPasswordToken: { equals: data.token } },
    })
    email = user?.email
  }
  if (!email) return
  // Payload starts a transaction before this hook. Serialize reset and resend across
  // server instances; the core operation rechecks token validity AFTER acquiring the lock.
  // Advisory locks avoid blocking Payload's separate email-throttle reservation transaction.
  const adapter = req.payload.db as unknown as PostgresAdapter
  const transactionID = await req.transactionID
  const transaction = transactionID && adapter.sessions[transactionID]?.db
  if (!transaction) throw new APIError('Password service temporarily unavailable.', 503)
  await transaction.execute(sql`SELECT pg_advisory_xact_lock(18472, hashtext(${email}))`)
  if (invitationRequests.has(req)) {
    const user = await req.payload.db.findOne<User>({
      collection: 'users',
      req,
      where: { email: { equals: email } },
    })
    if (!user?.invitationPending)
      throw new APIError(
        'This account has already been activated. Use Forgot password for recovery.',
        409,
      )
  }
  if (operation === 'resetPassword') passwordResets.add(req)
}

export const acceptInvitation: CollectionBeforeValidateHook = ({ data, req }) => {
  // resetPassword calls beforeValidate, then writes directly through the database adapter.
  // Mutate data: Payload's reset operation deliberately ignores the hook's return value.
  if (data && passwordResets.has(req)) {
    data.invitationPending = false
    passwordResets.delete(req)
  }
  return data
}

const response = (body: Record<string, unknown>, status = 200) => Response.json(body, { status })

async function sendInvitation(req: PayloadRequest, user: { id: number; email: string }) {
  invitationRequests.add(req)
  try {
    const token = await req.payload.forgotPassword({
      collection: 'users',
      data: { email: user.email },
      req,
    })
    if (!token)
      return response(
        {
          userId: user.id,
          delivery: 'throttled',
          message: 'Please wait one minute before sending another invitation.',
        },
        429,
      )
    return response({
      userId: user.id,
      delivery: 'sent',
      message: 'Invitation accepted by the email service. The link expires in one hour.',
    })
  } catch (error) {
    if (error instanceof AuthEmailDisabledError) {
      req.payload.logger.warn(
        { userId: user.id },
        'Auth email disabled: configure PAYLOAD_AUTH_EMAIL_TEST_TO for local/preview testing.',
      )
      return response({ userId: user.id, delivery: 'disabled', message: error.message }, 503)
    }
    if (error instanceof APIError && error.status === 409)
      return response({ userId: user.id, message: error.message }, 409)
    // Do not log provider errors: they can contain email bodies or reset tokens.
    req.payload.logger.error(
      { userId: user.id },
      'Invitation email failed; account remains pending.',
    )
    return response(
      {
        userId: user.id,
        delivery: 'failed',
        message:
          'The account exists, but the invitation could not be confirmed as sent. Open the account and resend the invitation.',
      },
      502,
    )
  } finally {
    invitationRequests.delete(req)
  }
}

export const inviteUser: Endpoint = {
  path: '/invite',
  method: 'post',
  handler: async (req) => {
    if (req.user?.collection !== 'users' || req.user.role !== 'admin')
      return response({ message: 'Administrator access required.' }, 403)
    let body: unknown
    try {
      body = await req.json?.()
    } catch {
      return response({ message: 'Invalid request.' }, 400)
    }
    if (!body || typeof body !== 'object') return response({ message: 'Invalid request.' }, 400)
    const input = body as Record<string, unknown>
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    const role = input.role
    if (
      !name ||
      name.length > 200 ||
      !email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !['admin', 'editor'].includes(String(role))
    ) {
      return response({ message: 'Enter a name, valid email address and valid role.' }, 400)
    }
    const existing = await req.payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length)
      return response(
        {
          message:
            'An account with this email already exists. Open it to resend a pending invitation, or use Forgot password.',
        },
        409,
      )
    let user
    try {
      // Commit the account before sending email. Only this explicit whitelist reaches
      // the privileged API; caller-supplied passwords, IDs and auth fields are ignored.
      user = await req.payload.create({
        collection: 'users',
        overrideAccess: true,
        data: {
          email,
          name,
          role: role as 'admin' | 'editor',
          password: randomBytes(48).toString('base64url'),
          invitationPending: true,
        },
      })
    } catch {
      // A simultaneous create is still protected by the database's unique email index.
      return response(
        {
          message:
            'Could not create the account. Check whether the email already exists before retrying.',
        },
        409,
      )
    }
    return sendInvitation(req, user)
  },
}

export const resendInvitation: Endpoint = {
  path: '/:id/resend-invitation',
  method: 'post',
  handler: async (req) => {
    if (req.user?.collection !== 'users' || req.user.role !== 'admin')
      return response({ message: 'Administrator access required.' }, 403)
    const id = Number(req.routeParams?.id)
    if (!Number.isSafeInteger(id) || id < 1)
      return response({ message: 'Invalid account ID.' }, 400)
    const result = await req.payload.find({
      collection: 'users',
      where: { id: { equals: id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const user = result.docs[0]
    if (!user) return response({ message: 'Account not found.' }, 404)
    if (!user.invitationPending)
      return response({ message: 'This account is active. Use Forgot password for recovery.' }, 409)
    return sendInvitation(req, user)
  },
}
