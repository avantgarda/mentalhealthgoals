import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentViewClientProps } from 'payload'

const state = vi.hoisted(() => ({
  id: undefined as number | undefined,
  data: {} as Record<string, unknown>,
  role: 'admin',
}))
vi.mock('@payloadcms/ui', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  useDocumentTitle: () => ({ setDocumentTitle: vi.fn() }),
  useStepNav: () => ({ setStepNav: vi.fn() }),
  useAuth: () => ({ user: { role: state.role } }),
  useDocumentInfo: () => state,
  DefaultEditView: ({ BeforeDocumentControls }: { BeforeDocumentControls: React.ReactNode }) => (
    <div>Existing user editor{BeforeDocumentControls}</div>
  ),
}))
import { UserEditView } from '@/components/admin/UserEditView'
const props = {} as DocumentViewClientProps
const fillForm = () => {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Anna Test' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'anna@example.test' } })
}
beforeEach(() => {
  state.id = undefined
  state.data = {}
  state.role = 'admin'
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('invitation admin interface', () => {
  it('creates an invitation without asking the admin to choose a password', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ userId: 12, message: 'Invitation sent.' }))
    vi.stubGlobal('fetch', fetcher)
    render(<UserEditView {...props} />)
    fillForm()
    expect(screen.queryByLabelText('Password')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Create account and send invitation' }))
    await screen.findByRole('status')
    expect(fetcher).toHaveBeenCalledWith(
      '/api/users/invite',
      expect.objectContaining({
        body: JSON.stringify({ name: 'Anna Test', email: 'anna@example.test', role: 'editor' }),
      }),
    )
    expect(
      screen.getByRole('link', { name: 'Open account and invitation status' }).getAttribute('href'),
    ).toBe('/admin/collections/users/12')
    expect(screen.queryByRole('button', { name: 'Create account and send invitation' })).toBeNull()
  })
  it('prevents duplicate submission while the request is pending', async () => {
    let resolve!: (value: Response) => void
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        }),
    )
    vi.stubGlobal('fetch', fetcher)
    render(<UserEditView {...props} />)
    fillForm()
    const form = screen
      .getByRole('button', { name: 'Create account and send invitation' })
      .closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(fetcher).toHaveBeenCalledTimes(1)
    resolve(Response.json({ userId: 12, message: 'Sent.' }))
    await screen.findByRole('status')
  })
  it('offers the created account after an email failure instead of creating it again', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { userId: 12, message: 'Email failed. Resend from the account.' },
            { status: 502 },
          ),
        ),
    )
    render(<UserEditView {...props} />)
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: 'Create account and send invitation' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Email failed')
    expect(screen.getByRole('link', { name: 'Open account and invitation status' })).toBeTruthy()
    expect(screen.queryByLabelText('Email')).toBeNull()
  })
  it('explains an ambiguous network failure and restores the form controls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')))
    render(<UserEditView {...props} />)
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: 'Create account and send invitation' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Check the Users list')
    expect(
      screen
        .getByRole('button', { name: 'Create account and send invitation' })
        .hasAttribute('disabled'),
    ).toBe(false)
  })
  it('shows resend only for a pending account viewed by an admin', async () => {
    state.id = 12
    state.data = { invitationPending: true }
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ message: 'Wait one minute.' }, { status: 429 }))
    vi.stubGlobal('fetch', fetcher)
    const view = render(<UserEditView {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Resend invitation' }))
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith('/api/users/12/resend-invitation', expect.anything()),
    )
    await screen.findByRole('alert')
    state.data = { invitationPending: false }
    view.rerender(<UserEditView {...props} />)
    expect(screen.queryByRole('button', { name: 'Resend invitation' })).toBeNull()
    state.data = { invitationPending: true }
    state.role = 'editor'
    view.rerender(<UserEditView {...props} />)
    expect(screen.queryByRole('button', { name: 'Resend invitation' })).toBeNull()
  })
  it('does not render the invitation form for non-admins', () => {
    state.role = 'editor'
    render(<UserEditView {...props} />)
    expect(screen.queryByLabelText('Email')).toBeNull()
  })
})
