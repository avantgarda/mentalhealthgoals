/** Local administrative process, not a running preview web deployment.
 * The caller must validate the Neon branch/endpoint before using its connection.
 * Never inherit production URL or email settings into this email-free process.
 */
export const previewEditorEnvironment = (connection: string, secret: string) => ({
  DATABASE_URL: connection,
  PAYLOAD_SECRET: secret,
  PAYLOAD_DB_PUSH: '0',
  VERCEL_ENV: 'development',
  NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000',
  RESEND_API_KEY: '',
  PAYLOAD_AUTH_EMAIL_TEST_TO: '',
})
