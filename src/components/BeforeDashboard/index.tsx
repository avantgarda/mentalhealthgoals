import type { ServerProps } from 'payload'

import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'

import { SeedButton } from './SeedButton'
import './index.scss'

const baseClass = 'before-dashboard'

/**
 * The block at the top of the dashboard.
 *
 * It used to carry Payload's starter copy — links to the Payload docs, an
 * instruction to commit and push, and a note explaining that the block itself
 * is a custom component. None of that is any use to the people who actually
 * sign in here, and it pushed the one genuinely dangerous control on the page
 * down into a numbered list of developer chores.
 *
 * What is left is the seed, with the warning it deserves. Editors see only the
 * welcome and the link to the site.
 */
const BeforeDashboard: React.FC<ServerProps> = ({ user }) => {
  const isAdmin = user?.role === 'admin'

  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>Mental Health Goals Programme</h4>
      </Banner>
      <p className={`${baseClass}__intro`}>
        {'Edit the site from the sections below, then '}
        <a href="/" rel="noopener noreferrer" target="_blank">
          view the site
        </a>
        {' to see your changes.'}
      </p>

      {isAdmin && (
        <div className={`${baseClass}__seed`}>
          <p>
            <strong>Reset the site content.</strong>
            {
              ' Replaces every page, workstream, person, partner, post and form with the ones written into the code — and deletes all form submissions with them, including Forum registrations. It cannot be undone. Export anything you need first.'
            }
          </p>
          <SeedButton />
        </div>
      )}
    </div>
  )
}

export default BeforeDashboard
