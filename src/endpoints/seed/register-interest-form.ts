import { RequiredDataFromCollectionSlug } from 'payload'

import { heading, paragraph, root, text } from './lexical'

/**
 * Registration for the Industry Engagement Forum.
 *
 * Deliberately separate from the contact form: this collects structured
 * attendee data — who is coming, from where, and what they need — where the
 * contact form collects a free-text message. The sticky bar on the Forum page
 * scrolls to it rather than sending people off to /contact, because a
 * same-page ask converts and a cross-page hop to a generic message box does
 * not.
 *
 * The personal data collected here is covered by the Privacy notice; keep the
 * two in step if the fields change. Access and dietary requirements can reveal
 * health or belief information, so they are optional and named explicitly in
 * that notice.
 */
export const registerInterestForm: RequiredDataFromCollectionSlug<'forms'> = {
  title: 'Industry Engagement Forum — register interest',
  submitButtonLabel: 'Register your interest',
  confirmationType: 'message',
  confirmationMessage: root(
    heading(
      'h2',
      text(
        'Thank you — your interest is registered. The Alliance Management Team will confirm your place and send joining details nearer the time.',
      ),
    ),
  ),
  emails: [
    {
      emailFrom: '"Mental Health Goals Programme" <noreply@mentalhealthgoals.co.uk>',
      emailTo: '{{email}}',
      subject: 'Your interest in the MHG Industry Engagement Forum',
      message: root(
        paragraph(
          text(
            'Thank you for registering your interest in the Mental Health Goals Industry Engagement Forum, launching 8 October 2026 at the SGDP Centre, Denmark Hill Campus, King’s College London.',
          ),
        ),
        paragraph(
          text(
            'The Alliance Management Team will be in touch to confirm your place and send joining details. If anything you told us changes, reply to this email and let us know.',
          ),
        ),
      ),
    },
    // Internal notification so registrations don't sit unseen in the CMS.
    // CONTACT_NOTIFICATION_EMAIL temporarily overrides the recipient until
    // enquiries@ is a real mailbox (M365 pending) — delete the env var then.
    {
      emailFrom: '"Mental Health Goals Programme" <noreply@mentalhealthgoals.co.uk>',
      emailTo: process.env.CONTACT_NOTIFICATION_EMAIL || 'enquiries@mentalhealthgoals.co.uk',
      replyTo: '{{email}}',
      subject: 'Forum registration — {{full-name}}, {{organisation}}',
      message: root(
        paragraph(text('A new registration of interest for the Industry Engagement Forum:')),
        paragraph(text('{{*:table}}')),
      ),
    },
  ],
  fields: [
    {
      name: 'full-name',
      blockName: 'full-name',
      blockType: 'text',
      label: 'Full name',
      required: true,
      width: 100,
    },
    {
      name: 'organisation',
      blockName: 'organisation',
      blockType: 'text',
      label: 'Organisation',
      required: true,
      width: 100,
    },
    {
      name: 'role',
      blockName: 'role',
      blockType: 'text',
      label: 'Role or job title',
      required: false,
      width: 100,
    },
    {
      name: 'email',
      blockName: 'email',
      blockType: 'email',
      label: 'Email',
      required: true,
      width: 100,
    },
    {
      name: 'attendance',
      blockName: 'attendance',
      blockType: 'select',
      label: 'Will you be attending?',
      required: true,
      width: 100,
      options: [
        {
          label: 'I would like to attend on 8 October 2026',
          value: 'attending',
        },
        {
          label: 'I cannot make this one, but I am interested in future forums',
          value: 'future',
        },
        {
          label: 'I cannot attend — please keep me informed',
          value: 'informed',
        },
      ],
    },
    {
      name: 'requirements',
      blockName: 'requirements',
      blockType: 'textarea',
      label: 'Access or dietary requirements (optional)',
      required: false,
      width: 100,
    },
    {
      name: 'consent',
      blockName: 'consent',
      blockType: 'checkbox',
      label: 'The Alliance Management Team may contact me about the Industry Engagement Forum.',
      required: true,
      width: 100,
    },
  ],
  redirect: undefined,
  createdAt: '2026-08-27T09:00:00.000Z',
  updatedAt: '2026-08-27T09:00:00.000Z',
}
