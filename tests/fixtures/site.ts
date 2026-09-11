/**
 * The names the test suite and its fixture agree on.
 *
 * Tests assert on these constants rather than on literal strings, so content
 * and assertions move together. A test that hardcodes a real person's name is
 * really a test of the content; a test that reads `FIXTURE.person.lead.name`
 * is a test of the page.
 *
 * This module is deliberately free of imports. Playwright loads it into its own
 * process, and pulling Payload's config in there drags `next/cache` behind it.
 *
 * Everything here is invented. No real person, institution or programme
 * document is named — that content lives in the production CMS now.
 */

/** Unique enough to search for and find exactly one result. */
const TOKEN = 'zarvex'

export type FixturePerson = {
  name: string
  role: string
  organisation: string
  group: 'leadership' | 'workstream-leads' | 'delivery'
  order: number
  bio: string
  /**
   * Workstream slugs. More than one on purpose for at least one person: the
   * team order uses the LOWEST workstream number, not the first listed.
   */
  workstreams: string[]
  withPhoto: boolean
}

export type FixtureWorkstream = {
  number: number
  title: string
  slug: string
  summary: string
  description: string
  deliveredBy: string
  group?: 'digit'
}

export type FixturePartner = {
  name: string
  slug: string
  strapline: string
  role: 'funder' | 'delivery' | 'partner'
  showInFooter: boolean
  url?: string
  withLogo: boolean
  order: number
}

/**
 * Six workstreams, because the index groups them and one test walks every
 * detail page. One carries the umbrella group, one carries a partner set, one
 * carries neither. The last title is deliberately short: a test measures
 * whether a title uses the width of the column it is given, and a long one
 * would wrap for honest reasons and defeat the measurement.
 */
export const workstreams: FixtureWorkstream[] = [
  {
    number: 1,
    title: 'Foundational Cohort Science',
    slug: 'foundational-cohort-science',
    summary: 'Builds the long-running cohort the other workstreams draw on.',
    description:
      'A fuller account of the cohort workstream, longer than the summary so the two can be told apart on the page that shows each of them.',
    deliveredBy: 'Northgate University',
  },
  {
    number: 2,
    title: 'Measurement and Instruments',
    slug: 'measurement-and-instruments',
    summary: 'Develops and validates the measures the programme reports against.',
    description:
      'A fuller account of the measurement workstream, longer than the summary so the two can be told apart on the page that shows each of them.',
    deliveredBy: 'Westmoor University · Northgate University',
  },
  {
    number: 3,
    title: 'Trials and Delivery',
    slug: 'trials-and-delivery',
    summary: 'Runs the programme’s clinical studies end to end.',
    description:
      'A fuller account of the trials workstream, longer than the summary so the two can be told apart on the page that shows each of them.',
    deliveredBy: 'Eastvale University',
  },
  {
    number: 4,
    title: 'Public and Community Partnership',
    slug: 'public-and-community-partnership',
    summary: 'Puts lived experience at the centre of how the programme decides.',
    description:
      'A fuller account of the partnership workstream, longer than the summary so the two can be told apart on the page that shows each of them.',
    deliveredBy: 'Southbank University',
  },
  {
    number: 5,
    title: 'Data Platform',
    slug: 'data-platform',
    summary: 'Holds the programme’s data and the rules for reaching it.',
    description:
      'A fuller account of the data workstream, longer than the summary so the two can be told apart on the page that shows each of them.',
    deliveredBy: 'Northgate University',
    group: 'digit',
  },
  {
    number: 6,
    title: 'Industry Alliance',
    slug: 'industry-alliance',
    summary: 'Runs the programme’s relationship with industry.',
    description:
      'A fuller account of the industry workstream, longer than the summary so the two can be told apart on the page that shows each of them.',
    deliveredBy: 'Westmoor University',
    group: 'digit',
  },
]

/**
 * Two in the footer band (a funder and a delivery body, which every page
 * shows), two more that appear only in page rows, and two programme partners.
 *
 * Neither of the two in the band is one of the universities that deliver a
 * workstream, and that is the point: the band is the site's one every-page
 * claim, so naming one delivery institution there would read as precedence
 * over the others.
 *
 * One partner deliberately has no logo. Where there is no artwork the site
 * renders a typographic lockup instead, so credit never waits on permission,
 * and that path needs exercising as much as the image one.
 */
export const partners: FixturePartner[] = [
  {
    name: 'Fictional Research Council',
    slug: 'fictional-research-council',
    strapline: 'Funder of the programme',
    role: 'funder',
    showInFooter: true,
    url: 'https://example.org/funder',
    withLogo: true,
    order: 1,
  },
  {
    name: 'National Delivery Body',
    slug: 'national-delivery-body',
    strapline: 'Delivered by',
    role: 'delivery',
    showInFooter: true,
    url: 'https://example.org/delivery-body',
    withLogo: true,
    order: 2,
  },
  {
    name: 'Westmoor University',
    slug: 'westmoor-university',
    strapline: 'Delivery partner',
    role: 'delivery',
    showInFooter: false,
    url: 'https://example.org/westmoor',
    withLogo: true,
    order: 3,
  },
  {
    // No logo: renders as a typographic lockup rather than an image.
    name: 'Eastvale University',
    slug: 'eastvale-university',
    strapline: 'Delivery partner',
    role: 'delivery',
    showInFooter: false,
    withLogo: false,
    order: 4,
  },
  {
    name: 'Harbour Data Trust',
    slug: 'harbour-data-trust',
    strapline: 'Programme partner',
    role: 'partner',
    showInFooter: false,
    url: 'https://example.org/harbour',
    withLogo: true,
    order: 5,
  },
  {
    name: 'Meridian Studies Network',
    slug: 'meridian-studies-network',
    strapline: 'Programme partner',
    role: 'partner',
    showInFooter: false,
    withLogo: true,
    order: 6,
  },
]

/**
 * Eight people across the three groups. The team page sorts by group, then by
 * the workstream's number, then by surname — so the surnames here are chosen to
 * be unambiguous under that sort, and two within one group share a workstream
 * so the surname tie-break is actually exercised.
 */
export const people: FixturePerson[] = [
  {
    name: 'Dr Ada Fenwick',
    role: 'Programme Director',
    organisation: 'Northgate University',
    group: 'leadership',
    order: 1,
    bio: 'Directs the programme and chairs its steering committee.',
    workstreams: ['foundational-cohort-science'],
    withPhoto: true,
  },
  {
    name: 'Prof. Bela Osric',
    role: 'Deputy Director',
    organisation: 'Westmoor University',
    group: 'leadership',
    order: 2,
    bio: 'Deputises for the director and leads the programme’s scientific strategy.',
    workstreams: ['measurement-and-instruments'],
    withPhoto: true,
  },
  {
    name: 'Dr Cora Bramley',
    role: 'Workstream Lead',
    organisation: 'Northgate University',
    group: 'workstream-leads',
    order: 10,
    bio: 'Leads the cohort workstream and its data collection.',
    workstreams: ['foundational-cohort-science'],
    withPhoto: true,
  },
  {
    // On two workstreams. Sorts under the first, not the fifth — and the
    // `order` values here are deliberately misleading, because nothing reads
    // them for the team listing.
    name: 'Dr Aled Wray',
    role: 'Workstream Lead',
    organisation: 'Northgate University',
    group: 'workstream-leads',
    order: 99,
    bio: 'Co-leads the cohort workstream and works on the data platform.',
    workstreams: ['foundational-cohort-science', 'data-platform'],
    withPhoto: false,
  },
  {
    name: 'Prof. Dilys Tarrant',
    role: 'Workstream Lead',
    organisation: 'Westmoor University',
    group: 'workstream-leads',
    order: 12,
    bio: 'Leads the measurement workstream.',
    workstreams: ['measurement-and-instruments'],
    withPhoto: true,
  },
  {
    name: 'Dr Evan Quill',
    role: 'Workstream Lead',
    organisation: 'Eastvale University',
    group: 'workstream-leads',
    order: 13,
    bio: 'Leads the trials workstream.',
    workstreams: ['trials-and-delivery'],
    withPhoto: true,
  },
  {
    name: 'Fionn Ashby',
    role: 'Alliance Manager',
    organisation: 'Northgate University',
    group: 'delivery',
    order: 20,
    bio: 'Runs the day-to-day management of the alliance.',
    workstreams: ['industry-alliance'],
    withPhoto: true,
  },
  {
    name: 'Greta Halloway',
    role: 'Research Assistant',
    organisation: 'Southbank University',
    group: 'delivery',
    order: 21,
    bio: 'Supports the partnership workstream.',
    workstreams: ['public-and-community-partnership'],
    withPhoto: false,
  },
]

/** The seven fields of the Forum's registration form, in order. */
export const registerFormLabels = [
  'Full name',
  'Organisation',
  'Role or job title',
  'Email',
  'Will you be attending?',
  'Access or dietary requirements (optional)',
  'The Alliance Management Team may contact me about the Forum.',
] as const

export type FixtureDoor = {
  heading: string
  standfirst: string
  /** The call to action at the end of the row. */
  label: string
  url: string
}

/**
 * The home page's audience "doors": three linked one-third columns, which the
 * content block sets as ruled rows clickable from edge to edge. Each goes
 * somewhere different, so a test can tell which row a press opened. The copy
 * stays clear of the words the search tests rank on.
 */
export const doors: FixtureDoor[] = [
  {
    heading: 'For partners',
    standfirst: 'A single place to begin working with the fictional programme.',
    label: 'Work with us',
    url: '/industry',
  },
  {
    heading: 'For the public',
    standfirst: 'Why the programme exists, and who is behind it.',
    label: 'About the programme',
    url: '/about',
  },
  {
    heading: 'For researchers',
    standfirst: 'Methods, data and collaboration across the programme.',
    label: 'Meet the team',
    url: '/people',
  },
]

export const FIXTURE = {
  /** The admin account the admin-panel tests sign in as. */
  admin: {
    name: 'Fixture Admin',
    email: 'fixture-admin@example.com',
    password: 'fixture-only-password',
  },

  workstreams,
  partners,
  people,
  doors,

  home: {
    /** The hero h1. */
    heading: 'A fictional programme for testing this website',
  },

  /** Convenience handles for the cases tests name individually. */
  person: {
    /** Has both a photograph and a biography, so the card opens a dialog. */
    lead: people[0],
    /** Has no photograph, so renders as initials. */
    withoutPhoto: people[3],
  },
  partner: {
    funder: partners[0],
    delivery: partners[1],
    /** In a page row but not the footer band. */
    pageOnly: partners[2],
    /** Has a logo and an external link, so it opens in a new tab. */
    external: partners[4],
    /** Renders as a typographic lockup, having no artwork. */
    withoutLogo: partners[3],
    /** Named in the footer band; no delivery institution may be. */
    inBand: [partners[0], partners[1]],
  },
  workstream: {
    /**
     * The only one with the full detail set, so it is where the section nav,
     * the partner row and the bullet lists are checked.
     */
    withSections: workstreams[0],
    withPartners: workstreams[0],
    /** Two institutions, which stay as text: a logo would rank one above the other. */
    multiInstitution: workstreams[1],
    /** Carries the umbrella team; both grouped ones are consecutive by number. */
    grouped: workstreams[4],
    /** Deliberately short, for the column-width measurement. */
    shortTitle: workstreams[5],
  },

  /**
   * The order the team page must render its workstream leads in.
   *
   * Written out rather than computed, so a change to the sort shows up here as
   * a deliberate edit. The rule it follows — lowest workstream number, then
   * surname — lives in src/utilities/people.ts and is guarded by
   * tests/unit/people.spec.ts; this is the fixture's own statement of what
   * that rule produces for these eight people.
   *
   * Bramley and Wray share the lowest number, so surname breaks the tie. Wray
   * is also on workstream 5, which must not move him.
   */
  expectedLeadOrder: ['Dr Cora Bramley', 'Dr Aled Wray', 'Prof. Dilys Tarrant', 'Dr Evan Quill'],

  /** The closing note under the team, and the passage with no gutter beside it. */
  closingNote:
    'Governance connects every workstream through a steering committee that meets quarterly.',

  /** The address the industry page invites people to write to. */
  contactEmail: 'enquiries@example.org',

  umbrella: {
    /** The h1 of the page describing the umbrella team. */
    pageTitle: 'The umbrella team',
  },

  posts: {
    news: {
      title: 'The programme publishes its first annual report',
      slug: 'the-programme-publishes-its-first-annual-report',
    },
    /**
     * eventDate is computed at load time, never a literal. A hardcoded date
     * stops being upcoming the day after it passes, and this test would then
     * fail for a reason that has nothing to do with the code.
     */
    event: {
      title: 'Industry Forum launch meeting',
      slug: 'industry-forum-launch-meeting',
      /** How far ahead load.ts places it. */
      daysAhead: 60,
    },
  },

  forum: {
    /** The formBlock's blockName, which becomes the #register anchor. */
    blockName: 'Register',
    stickyLabel: 'Register your interest',
    stickyMessage: 'Launch meeting this autumn',
    /** The h1, and the heading the home page uses to point at it. */
    heading: 'Forum launch meeting',
    /** Exact heading the industry page uses to name the Forum itself. */
    plainName: 'Industry Engagement Forum',
    formLabels: registerFormLabels,
    /** Appears in this page's body and nowhere else, so search finds one hit. */
    onlyHereToken: `${TOKEN}-forumonly`,
    confirmation: 'your registration has been received',
  },

  contact: {
    /** Field names the contact test types into. */
    fields: { name: 'full-name', email: 'email', message: 'message' },
    confirmation: 'your message has been received',
  },

  search: {
    /** Appears in exactly one page title, and nowhere else. */
    titleToken: `${TOKEN}-titled`,
    /** Appears in exactly one page body, and in no title. */
    bodyToken: `${TOKEN}-buried`,
    /** Matches nothing at all. */
    absentToken: `${TOKEN}-absent`,
  },

  /** Navigation label that must be reachable from the header on every page. */
  headerLink: { label: 'About', url: '/about' },
} as const
