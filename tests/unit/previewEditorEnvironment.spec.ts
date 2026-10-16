import { describe, expect, it } from 'vitest'
import { previewEditorEnvironment } from '../../scripts/lib/preview-editor-environment'
import { getPayloadServerURL } from '@/utilities/getPayloadServerURL'
import { emailConfig, shouldSendRealEmail } from '@/utilities/emailConfig'

describe('local preview canary bootstrap', () => {
  it('loads without a deployment hostname and cannot send account or form mail', async () => {
    const env = {
      VERCEL_ENV: 'production',
      VERCEL_PROJECT_PRODUCTION_URL: 'www.mentalhealthgoals.co.uk',
      NEXT_PUBLIC_SERVER_URL: 'https://www.mentalhealthgoals.co.uk',
      RESEND_API_KEY: 'inherited-key',
      PAYLOAD_AUTH_EMAIL_TEST_TO: 'inherited@example.test',
    }
    Object.assign(
      env,
      previewEditorEnvironment('postgresql://localhost/isolated-test', 'local-only-secret'),
    )
    expect(getPayloadServerURL(env)).toBe('http://localhost:3000')
    expect(shouldSendRealEmail(env)).toEqual({ send: false })
    const adapter = emailConfig(env).email({ payload: {} as never })
    await expect(
      adapter.sendEmail({ to: 'canary@example.invalid', subject: 'Test' }),
    ).rejects.toThrow(/disabled/)
  })
})
