import { APIError, type CollectionConfig } from 'payload'
import {
  acceptInvitation,
  guardPasswordOperations,
  inviteUser,
  resendInvitation,
} from './invitations'
import { passwordEmail } from './passwordEmail'

import { authenticated } from '../../access/authenticated'
import { isAdmin, isAdminFieldLevel, isAdminOrSelf } from '../../access/isAdmin'

export const Users: CollectionConfig = {
  slug: 'users',
  disableDuplicate: true,
  access: {
    admin: authenticated,
    create: isAdmin,
    delete: isAdmin,
    read: isAdminOrSelf,
    unlock: isAdmin,
    update: isAdminOrSelf,
  },
  admin: {
    group: 'Admin',
    hidden: ({ user }) => user?.role !== 'admin',
    components: {
      views: { edit: { default: { Component: '@/components/admin/UserEditView#UserEditView' } } },
    },
    defaultColumns: ['name', 'email', 'role', 'invitationPending'],
    useAsTitle: 'name',
  },
  auth: {
    forgotPassword: {
      expiration: 60 * 60 * 1000,
      minRequestInterval: 60 * 1000,
      generateEmailHTML: passwordEmail,
      generateEmailSubject: ({ user } = {}) =>
        user?.invitationPending
          ? 'Your Mental Health Goals Programme account invitation'
          : 'Reset your Mental Health Goals Programme password',
    },
  },
  endpoints: [inviteUser, resendInvitation],
  hooks: {
    beforeOperation: [guardPasswordOperations],
    beforeValidate: [acceptInvitation],
    beforeLogin: [
      ({ user }) => {
        if (user.invitationPending)
          throw new APIError(
            'Set your password using your invitation email, or request a new link using Forgot password.',
            403,
          )
        return user
      },
    ],
  },
  fields: [
    {
      name: 'invitationPending',
      type: 'checkbox',
      defaultValue: false,
      access: { create: () => false, update: () => false },
      admin: {
        readOnly: true,
        position: 'sidebar',
        components: { Field: '@/components/admin/AccountStatusField#AccountStatusField' },
      },
    },
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      saveToJWT: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
      ],
      access: {
        // Only admins can grant or change roles
        create: isAdminFieldLevel,
        update: isAdminFieldLevel,
      },
      admin: {
        position: 'sidebar',
        description: 'Admins manage users; editors manage content only.',
      },
      hooks: {
        beforeChange: [
          // The very first user (create-first-user screen) must be an admin,
          // otherwise the site would have no one able to manage users.
          async ({ req, value, operation }) => {
            if (operation === 'create') {
              const { totalDocs } = await req.payload.count({ collection: 'users' })
              if (totalDocs === 0) return 'admin'
            }
            return value
          },
        ],
      },
    },
  ],
  timestamps: true,
}
