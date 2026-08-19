declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PAYLOAD_SECRET: string
      DATABASE_URL: string
      NEXT_PUBLIC_SERVER_URL: string
      VERCEL_PROJECT_PRODUCTION_URL: string
      CRON_SECRET: string
      PREVIEW_SECRET: string
      RESEND_API_KEY?: string
      BLOB_READ_WRITE_TOKEN?: string
      SEED_ADMIN_EMAIL?: string
      SEED_ADMIN_PASSWORD?: string
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}
