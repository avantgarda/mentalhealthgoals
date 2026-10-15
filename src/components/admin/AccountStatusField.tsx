'use client'

import { useField } from '@payloadcms/ui'
import type { CheckboxFieldClientProps } from 'payload'

export function AccountStatusField({ path }: CheckboxFieldClientProps) {
  const { value } = useField<boolean>({ path })
  return (
    <section aria-label="Account status" style={{ display: 'block', lineHeight: 1.6 }}>
      <div style={{ marginBottom: '0.5rem' }}>Account status</div>
      <strong style={{ display: 'block', marginBottom: '0.5rem' }}>
        {value ? 'Pending password setup' : 'Active'}
      </strong>
      <p style={{ display: 'block', margin: 0, color: 'var(--theme-elevation-500)' }}>
        {value
          ? 'The user still needs to choose a password using an emailed link.'
          : 'No invitation is outstanding for this account.'}
      </p>
    </section>
  )
}
