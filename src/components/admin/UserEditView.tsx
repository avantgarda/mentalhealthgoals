'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  Button,
  DefaultEditView,
  useAuth,
  useDocumentInfo,
  useDocumentTitle,
  useStepNav,
} from '@payloadcms/ui'
import type { DocumentViewClientProps } from 'payload'
import Link from 'next/link'
import './user-invitation.css'

export function UserEditView(props: DocumentViewClientProps) {
  const { id, data } = useDocumentInfo()
  const { user } = useAuth()
  const { title, setDocumentTitle } = useDocumentTitle()
  const { setStepNav } = useStepNav()
  useEffect(() => {
    if (!id && title !== 'Invite user') {
      // DocumentTitleProvider initializes its fallback in a parent effect. Apply the
      // create-screen title afterward, as Payload's default edit view does.
      const frame = requestAnimationFrame(() => {
        setDocumentTitle('Invite user')
        setStepNav([{ label: 'Users', url: '/admin/collections/users' }, { label: 'Invite user' }])
      })
      return () => cancelAnimationFrame(frame)
    }
  }, [id, title, setDocumentTitle, setStepNav])
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [message, setMessage] = useState('')
  const [createdID, setCreatedID] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)

  async function send(url: string, body?: Record<string, string>) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setMessage('')
    setFailed(false)
    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      })
      const result = await response.json()
      if (result.userId) setCreatedID(result.userId)
      setFailed(!response.ok)
      setMessage(
        result.message ||
          'The request could not be completed. Check the Users list before retrying.',
      )
    } catch {
      setFailed(true)
      setMessage(
        'The result could not be confirmed. Check the Users list before retrying; the account may already have been created.',
      )
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const feedback = message && (
    <p className="mhg-invitation-feedback" role={failed ? 'alert' : 'status'}>
      {message}
    </p>
  )
  if (id)
    return (
      <>
        {user?.role === 'admin' && data?.invitationPending && (
          <section className="mhg-user-invitation-status" aria-label="Pending invitation">
            <p>
              This account is waiting for password setup. Save any email address changes before
              resending. A successful resend replaces its previous link.
            </p>
            <Button
              type="button"
              disabled={busy}
              onClick={() => send(`/api/users/${id}/resend-invitation`)}
            >
              {busy ? 'Sending…' : 'Resend invitation'}
            </Button>
            {feedback}
          </section>
        )}
        <DefaultEditView {...props} />
      </>
    )

  if (user?.role !== 'admin') return <p>Administrator access required.</p>
  return (
    <section className="mhg-user-invitation" aria-label="Invite user">
      <p>The new user will receive a link to choose their own password. It expires in one hour.</p>
      {!createdID && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            void send('/api/users/invite', {
              name: String(form.get('name')),
              email: String(form.get('email')),
              role: String(form.get('role')),
            })
          }}
        >
          <fieldset disabled={busy}>
            <label>
              Name
              <input name="name" required maxLength={200} autoComplete="name" />
            </label>
            <label>
              Email
              <input name="email" type="email" required maxLength={254} autoComplete="email" />
            </label>
            <label>
              Role
              <select name="role" defaultValue="editor">
                <option value="editor">Editor — create and edit content</option>
                <option value="admin">Admin — full access, including user management</option>
              </select>
            </label>
            <Button type="submit">
              {busy ? 'Creating account and sending…' : 'Create account and send invitation'}
            </Button>
          </fieldset>
        </form>
      )}
      {feedback}
      <div className="mhg-invitation-actions">
        {createdID && (
          <p>
            <Link href={`/admin/collections/users/${createdID}`}>
              Open account and invitation status
            </Link>
          </p>
        )}
        <p>
          <Link href="/admin/collections/users">Back to users</Link>
        </p>
      </div>
    </section>
  )
}
