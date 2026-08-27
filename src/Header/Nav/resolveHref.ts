import type { Header } from '@/payload-types'

type NavLink = NonNullable<Header['navItems']>[number]['link']

/** Mirror of CMSLink's href resolution so the nav can render plain anchors. */
export const resolveHref = (link: NavLink): string | null => {
  if (link.type === 'reference' && typeof link.reference?.value === 'object') {
    const { relationTo, value } = link.reference
    if (!value.slug) return null
    return relationTo === 'pages' ? `/${value.slug}` : `/${relationTo}/${value.slug}`
  }
  return link.url || null
}

/** Active for the exact path and for descendants (e.g. /workstreams/multi-omics). */
export const isActive = (href: string, pathname: string): boolean => {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
