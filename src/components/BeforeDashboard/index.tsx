import type { ServerProps } from 'payload'

import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'

import './index.scss'

const baseClass = 'before-dashboard'

/**
 * The block at the top of the dashboard.
 *
 * It used to carry Payload's starter copy — links to the Payload docs, an
 * instruction to commit and push, and a note explaining that the block itself
 * is a custom component. None of that is any use to the people who actually
 * sign in here.
 *
 * It also used to carry the Seed button, which replaced every page, workstream,
 * person and post with the ones written into the code. That made sense while
 * the repository held the content. It is now the other way round: this CMS is
 * where the content lives, so a button that overwrites it from a snapshot is
 * only a way to lose work.
 */
const BeforeDashboard: React.FC<ServerProps> = () => (
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
  </div>
)

export default BeforeDashboard
