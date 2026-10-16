# CMS accounts and password recovery

## Accounts and invitations

Admins open **Admin → Users → Create New**, enter name, email and role, then choose
**Create account and send invitation**. Editor is the default. The recipient gets a
one-hour, single-use link to Payload's native password setup screen. Invitations are not
passwordless login links: subsequent sign-ins use email and password.

The account is saved with an unshared random password and **Pending password setup** status.
It cannot log in until the recipient sets a password through the link. Existing accounts,
passwords and roles are unchanged by this feature. The first-user bootstrap still creates an
active admin. Trusted integrations can still create accounts through Payload's ordinary
admin-only API; that route does not send invitations.

- Only admins create, delete or unlock accounts and change roles.
- Editors can read and update only their own account. The Users navigation is hidden for them;
  the API enforces the restriction independently of navigation.
- Pending status is read-only, including for admins through the ordinary API.
- There is no new read-only role; MHG retains admin and editor.

## Retry and recovery

The interface confirms acceptance by the email provider, not inbox delivery. A delivery failure
leaves the account pending. Open that account and choose **Resend invitation**, rather than
creating another account. Save any corrected email address first. A successful resend replaces
the old link. If the provider rejects a resend, the old unexpired link remains usable.

Wait one minute between successful send requests. Unknown recovery emails receive Payload's
normal generic response. A pending user may also choose **Forgot password?** to obtain a fresh
setup link. Active accounts use **Forgot password?** for recovery; invitation resend is disabled
for them. Deleting a pending account revokes its setup link.

A network timeout can leave delivery uncertain. Check the Users list before retrying: account
creation or provider acceptance may already have happened. Email delivery and database commit
cannot be one atomic operation.

## Environment configuration

| Setting                      | Production             | Local / Preview                                          |
| ---------------------------- | ---------------------- | -------------------------------------------------------- |
| `RESEND_API_KEY`             | Required for delivery  | Required for a real inbox test                           |
| `PAYLOAD_AUTH_EMAIL_TEST_TO` | Ignored                | Required private mailbox for all account mail            |
| `EMAIL_OVERRIDE_RECIPIENT`   | Ignored                | Form notifications only; does not enable account mail    |
| `NEXT_PUBLIC_SERVER_URL`     | Canonical HTTPS origin | Local origin and port; previews use `VERCEL_URL` instead |

The sender is `Mental Health Goals Programme <noreply@mentalhealthgoals.co.uk>`; verify its
domain in Resend. Production means `VERCEL_ENV=production`. Review this gate before moving
hosting away from Vercel. A missing key or missing nonproduction auth mailbox causes account
mail to fail explicitly, never to claim delivery through a console adapter. Neither reset tokens
nor provider response bodies are logged by the account mail adapter.

Use a private test mailbox: it receives account takeover links for the test database. Local sync
excludes production users by default; retain that behaviour. Use synthetic users for preview QA.

Form notifications and branded visitor replies retain their existing routing and templates.
The form hook always marks its messages, including when branding fails; unmarked mail uses
the stricter account policy. Future non-form email producers must review this policy.

## Compatibility with content tools

Active editors still use the existing JWT login, PDF-upload and content-update APIs. The
preview canary helper creates an active account through the trusted Local API; its local process
uses a localhost origin with email disabled, while its existing Neon checks select the isolated
preview database. It does not need a preview web hostname merely to create or delete that account.

Payload's explicit auth server origin also affects generated Media URLs. The Media after-read
hook keeps this deployment's file URLs relative, including image derivatives; external storage
URLs remain unchanged. This preserves PDF links and local image optimisation without rewriting
stored records or files.

## Deployment and inbox verification

1. Review and merge the code through normal CI. `build:deploy` applies the additive
   `20261015_220000_user_invitations` migration before serving the new code. It adds one boolean
   with a false default; it does not rewrite account credentials or content.
2. On a preview, configure Resend and the private auth mailbox; retain the form override if
   testing forms. Verify that reset links target that preview, not production. A protected
   preview may require Vercel access before the recipient can open it.
3. Invite a synthetic editor. Check the actual inbox, sender, wording and link host. Open the
   link, set a password, confirm Active status, then log out and sign in with that password.
4. Exercise Forgot password, successful resend, expired/reused links, and the pending-account
   screen on desktop and mobile. Check an existing active account still logs in normally.
5. Verify an editor can update their own profile, cannot list others or grant a role, and cannot
   unlock an account. Confirm contact-form notification and auto-reply routing still works.
6. In production, confirm the canonical origin and Resend sender configuration, then repeat
   delivery and recovery with an authorised test account before inviting staff.

Code rollback can leave the additive column in place. Do not run its down migration while the
new code serves requests. No live inbox delivery is established by automated capture tests.

## Automated checks

`pnpm test:int` includes email, URL, UI and existing integration tests. The account lifecycle
suite needs an explicit disposable database; it never falls back to `DATABASE_URL`:

```sh
AUTH_TEST_DATABASE_URL=postgresql://USER@127.0.0.1:PORT/mhg_auth_test \
  pnpm exec vitest run tests/int/user-invitations-db.int.spec.ts
```

Only localhost and the exact `mhg_auth_test` database name are accepted. The suite builds a
minimal Users schema, exercises migration up/down, and leaves synthetic accounts. All its
emails stay in memory. CI creates this separate database and runs the suite automatically.

Coverage includes pending login, native setup/recovery, expiry and reuse, failed sends and
retry, throttling, duplicate creation, concurrent reset/resend, HTTP cookie/CSRF checks,
account-read restrictions and role/status protection. PostgreSQL transaction advisory locks
serialize password operations per email across instances. These hooks depend on Payload
starting the transaction before `beforeOperation` and calling `beforeValidate` during reset;
rerun this suite on every Payload upgrade.

Also run typecheck, lint, generated-types drift and migration parity before merging.
