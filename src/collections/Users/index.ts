import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { isAdmin, isAdminFieldLevel, isAdminOrSelf } from '../../access/isAdmin'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    create: isAdmin,
    delete: isAdmin,
    read: authenticated,
    update: isAdminOrSelf,
  },
  admin: {
    defaultColumns: ['name', 'email', 'role'],
    useAsTitle: 'name',
  },
  auth: true,
  fields: [
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
        description:
          'Admins manage users and can reseed the site; editors manage content only.',
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
