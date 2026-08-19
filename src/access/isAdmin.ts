import type { AccessArgs, FieldAccess } from 'payload'

import type { User } from '@/payload-types'

type AccessFn = (args: AccessArgs<User>) => boolean

export const isAdmin: AccessFn = ({ req: { user } }) => {
  return user?.role === 'admin'
}

/** Admins can act on anyone; everyone else only on their own user document. */
export const isAdminOrSelf = ({ req: { user }, id }: AccessArgs<User>): boolean => {
  if (user?.role === 'admin') return true
  return Boolean(user && id && user.id === id)
}

export const isAdminFieldLevel: FieldAccess = ({ req: { user } }) => {
  return user?.role === 'admin'
}
