// Any setup scripts you might need go here

// The integration suite talks to a real database, so it needs DATABASE_URL.
// `.env.local` is where local configuration lives — it is what `vercel env
// pull` writes and what Next reads first — and dotenv's default entry point
// only reads `.env`, so the path is given explicitly. Ambient variables win:
// CI sets them on the job and never writes a file.
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })
