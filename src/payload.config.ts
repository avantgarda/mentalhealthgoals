import { postgresAdapter } from '@payloadcms/db-postgres'
import { resendAdapter } from '@payloadcms/email-resend'
import sharp from 'sharp'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'

import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { People } from './collections/People'
import { Partners } from './collections/Partners'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'
import { Workstreams } from './collections/Workstreams'
import { Brand } from './brand/config'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { ProgrammeDetails } from './ProgrammeDetails/config'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeLogin: ['@/components/BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeDashboard: ['@/components/BeforeDashboard'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    push: process.env.NODE_ENV === 'development', // Auto-sync schema in dev, use migrations in production
  }),
  collections: [Pages, Posts, Media, Categories, Users, Workstreams, People, Partners],
  // Without an adapter Payload writes emails to the console — fine in dev,
  // but production (password resets, contact-form notifications) needs Resend.
  // The mentalhealthgoals.co.uk domain must be verified in Resend before
  // emails will send from it.
  ...(process.env.RESEND_API_KEY
    ? {
        email: resendAdapter({
          defaultFromAddress: 'noreply@mentalhealthgoals.co.uk',
          defaultFromName: 'Mental Health Goals Programme',
          apiKey: process.env.RESEND_API_KEY,
        }),
      }
    : {}),
  cors: [getServerSideURL()].filter(Boolean),
  globals: [Header, Footer, Brand, ProgrammeDetails],
  plugins,
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        const secret = process.env.CRON_SECRET
        if (!secret) return false

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${secret}`
      },
    },
    tasks: [],
  },
})
