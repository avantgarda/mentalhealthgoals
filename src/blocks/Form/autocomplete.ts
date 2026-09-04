/**
 * Browsers can fill a form in one tap, but only when told what each field is
 * for. The form builder has no such setting, so the token is derived from the
 * field's name — the names are ours, set in the seed, and stable.
 */
const TOKENS: Record<string, string> = {
  'full-name': 'name',
  name: 'name',
  email: 'email',
  phone: 'tel',
  telephone: 'tel',
  organisation: 'organization',
  organization: 'organization',
  role: 'organization-title',
}

export const autoCompleteFor = (name?: string): string | undefined =>
  name ? TOKENS[name.toLowerCase()] : undefined
