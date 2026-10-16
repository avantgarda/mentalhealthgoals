import type { Access, AccessArgs, FieldAccess } from 'payload'

import type { User } from '@/payload-types'

type AccessFn = (args: AccessArgs<User>) => boolean

export const isAdmin: AccessFn = ({ req: { user } }) => {
  return user?.role === 'admin'
}

/** Admins can act on anyone; everyone else only on their own user document. */
export const isAdminOrSelf: Access<User> = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  return { id: { equals: user.id } }
}

export const isAdminFieldLevel: FieldAccess = ({ req: { user } }) => {
  return user?.role === 'admin'
}
