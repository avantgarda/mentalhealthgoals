import type { PayloadRequest } from 'payload'

const escapeHTML = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  )

export function passwordEmail({
  req,
  token,
  user,
}: {
  req?: PayloadRequest
  token?: string
  user?: { name?: string | null; invitationPending?: boolean | null }
} = {}) {
  if (!req || !token) throw new Error('Password email requires a request and token.')
  const config = req.payload.config
  const base = new URL(config.serverURL)
  if (
    base.protocol !== 'https:' &&
    !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))
  )
    throw new Error('Password email requires a secure server URL.')
  const link = new URL(
    `${config.routes.admin}${config.admin.routes.reset}/${encodeURIComponent(token)}`,
    base,
  ).href
  const invite = user?.invitationPending
  return `<p>Hello${user?.name ? ` ${escapeHTML(user.name)}` : ''},</p>
<p>${invite ? 'You have been invited to manage content for Mental Health Goals Programme. Choose your own password to activate your account.' : 'A password reset was requested for your Mental Health Goals Programme account.'}</p>
<p><a href="${escapeHTML(link)}">${invite ? 'Set your password' : 'Reset your password'}</a></p>
<p>This link expires in one hour and can only be used once. After setting your password, sign in using your email and password.</p>
<p>${invite ? 'If you were not expecting this invitation, contact your site administrator.' : 'If you did not request this, you can ignore this email. Your password has not changed.'}</p>`
}
