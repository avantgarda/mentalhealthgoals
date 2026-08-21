/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CollectionSlug, GlobalSlug, Payload, PayloadRequest, File } from 'payload'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { contactForm as contactFormData } from './contact-form'
import { bold, bullets, heading, link, paragraph, root, text } from './lexical'
import { workstreamContent } from './workstream-content'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Cleared sequentially, dependents first — search references posts,
// form-submissions reference forms, pages reference forms/media. Parallel
// deletes here caused a Postgres deadlock in production (conflicting FK lock
// order between "search" and "posts").
const collections: CollectionSlug[] = [
  'search',
  'form-submissions',
  'posts',
  'pages',
  'forms',
  'workstreams',
  'people',
  'categories',
  'media',
]

/** Payload array fields hold objects; the content module stores plain strings. */
const toBullets = (points: string[]) => points.map((point) => ({ point }))

// Only the navigation globals are cleared on reseed; site settings such as the
// Brand global keep whatever an editor has chosen.
const globals = ['header', 'footer'] as const satisfies readonly GlobalSlug[]

// Next.js revalidation errors are normal when seeding the database without a server running
// i.e. running `pnpm seed` locally instead of using the admin UI within an active app
export const seed = async ({
  payload,
  req,
}: {
  payload: Payload
  req: PayloadRequest
}): Promise<void> => {
  payload.logger.info('Seeding database...')

  payload.logger.info(`— Clearing collections and globals...`)

  await Promise.all(
    globals.map((global) =>
      payload.updateGlobal({
        slug: global,
        data: {
          navItems: [],
        },
        depth: 0,
        context: {
          disableRevalidate: true,
        },
      }),
    ),
  )

  for (const collection of collections) {
    await payload.db.deleteMany({ collection, req, where: {} })
  }

  for (const collection of collections) {
    if (payload.collections[collection].config.versions) {
      await payload.db.deleteVersions({ collection, req, where: {} })
    }
  }

  payload.logger.info(`— Seeding media...`)

  const [heroImageDoc, cardTealDoc, cardAmberDoc] = await Promise.all([
    payload.create({
      collection: 'media',
      data: {
        alt: 'Abstract concentric rings on a deep teal background — the Mental Health Goals motif',
      },
      file: localFile('mhg-hero.webp'),
    }),
    payload.create({
      collection: 'media',
      data: {
        alt: 'Abstract concentric rings on a teal background',
      },
      file: localFile('mhg-card-teal.webp'),
    }),
    payload.create({
      collection: 'media',
      data: {
        alt: 'Abstract concentric rings on a teal and amber background',
      },
      file: localFile('mhg-card-amber.webp'),
    }),
  ])

  payload.logger.info(`— Seeding categories...`)

  const [newsCategory, eventsCategory] = await Promise.all([
    payload.create({
      collection: 'categories',
      data: { title: 'Programme news', slug: 'programme-news' },
    }),
    payload.create({
      collection: 'categories',
      data: { title: 'Events', slug: 'events' },
    }),
  ])

  payload.logger.info(`— Seeding workstreams...`)

  const workstreams = [
    {
      number: 1,
      title: 'Alliance Management Team (AMT)',
      slug: 'alliance-management-team',
      summary:
        'A single, simple front door bringing industry into UK mental health research and trials.',
      description:
        'The AMT is a wrap-around service for industry — linking companies with methodology expertise in trial design and delivery, the lived experience partnership, bespoke IP and royalty strategies, funding applications and advisory board development. It provides a seamless structure that is simple to navigate for companies of every size, complementing the NIHR Innovation Service and the MRC Mental Health Platform.',
      deliveredBy: 'King’s College London',
    },
    {
      number: 2,
      title: 'Innovative Trials Hub (ITH)',
      slug: 'innovative-trials-hub',
      summary: 'Designs and delivers precision psychiatry trials with industry.',
      description:
        'The ITH provides statistical and methodological expertise in the design and analysis of precision psychiatry studies, from early-phase biomarker-guided designs through adaptive Phase 2 and 3 trials — plus the infrastructure for multi-arm multi-stage platform studies delivered at scale in primary and community settings.',
      deliveredBy: 'King’s College London',
    },
    {
      number: 3,
      title: 'Lived Experience Industry Partnership (LEIP)',
      slug: 'lived-experience-industry-partnership',
      summary: 'Establishes patient experience as central to industry priorities.',
      description:
        'The LEIP creates a new alliance between patients and industry — joint priority setting, deliberative dialogues and communities of practice that align what patients want with what industry develops, and rebalance power between patients, research and industry.',
      deliveredBy: 'University of Oxford',
    },
    {
      number: 4,
      title: 'Digital Innovation',
      slug: 'digital-innovation',
      summary: 'Helps digital health technology launch, adopt and scale in the NHS.',
      description:
        'The Digital Innovation workstream supports digital health technologies through launch, adoption and scale in the NHS — creating clear pathways for digital therapeutics and measurement tools to reach the people who need them.',
      deliveredBy: 'University of Manchester',
    },
    {
      number: 5,
      title: 'Data Observatory',
      slug: 'data-observatory',
      summary: 'An industry-facing platform for trial feasibility and AI-driven analytics.',
      description:
        'The Data Observatory provides feasibility and protocol-design services over national data assets — supporting site selection, recruitment planning and AI-driven analytics within trusted research environments.',
      deliveredBy: 'University of Manchester · Swansea University',
    },
    {
      number: 6,
      title: 'Multi-omics',
      slug: 'multi-omics',
      summary:
        'A world-first multi-omics resource across 20,000 deeply clinically characterised participants.',
      description:
        'Building on the GLAD (Genetic Links to Anxiety and Depression) Study, the Multi-omics workstream combines biological and clinical data for psychosis and severe depression at unprecedented depth — enabling the next generation of personalised treatments.',
      deliveredBy:
        'King’s College London · Cardiff University · Queen’s University Belfast · University of Edinburgh · University of Cambridge',
    },
  ]

  await Promise.all(
    workstreams.map((data) => {
      const content = workstreamContent[data.slug]
      return payload.create({
        collection: 'workstreams',
        context: { disableRevalidate: true },
        data: {
          ...data,
          // Pin the slug so seeded URLs match the backfill migration's
          generateSlug: false,
          boundaryStatement: content.boundaryStatement,
          primaryFocus: toBullets(content.primaryFocus),
          keyQuestions: toBullets(content.keyQuestions),
          differentiators: toBullets(content.differentiators),
        },
      })
    }),
  )

  payload.logger.info(`— Seeding people...`)

  const people = [
    {
      order: 1,
      name: 'Prof. Mitul Mehta',
      role: 'Lead, Alliance Management Team',
      organisation: 'King’s College London',
      bio: 'Professor of Neuroimaging & Psychopharmacology and Director of the Centre for Innovative Therapeutics at King’s College London. Leads the Experimental Medicine & Novel Therapeutics theme at the NIHR-Maudsley Biomedical Research Centre.',
    },
    {
      order: 2,
      name: 'Prof. Richard Emsley',
      role: 'Co-Lead',
      organisation: 'King’s College London',
      bio: 'NIHR Research Professor and Professor of Medical Statistics and Trials Methodology at the IoPPN. Academic Director of King’s Clinical Trials Unit and Theme Lead for Trials, Genomics and Prediction in the NIHR Maudsley BRC.',
    },
    {
      order: 3,
      name: 'Siân Rees',
      role: 'Co-Lead',
      organisation: 'Health Innovation Oxford & Thames Valley',
      bio: 'Director of Community Involvement and Workforce Innovation, with a background in public health medicine and a decade in mental health policy at the Department of Health.',
    },
    {
      order: 4,
      name: 'Prof. Edward Harcourt',
      role: 'Co-Lead',
      organisation: 'University of Oxford',
      bio: 'Professor of Philosophy at the University of Oxford. Academic Lead for Patient and Public Involvement in the Oxford Health BRC and the Mental Health Translational Research Collaboration / Mental Health Mission.',
    },
    {
      order: 5,
      name: 'Non Hill',
      role: 'Lived Experience Lead',
      organisation: 'Oxford & Thames Valley Health Innovation Network',
      bio: 'Brings over a decade of lived experience as a carer, professional lived experience roles across Healthwatch Surrey and Surrey and Borders Partnership NHS Foundation Trust, and a previous decade as a research neuroscientist in the pharmaceutical industry.',
    },
    {
      order: 6,
      name: 'Eric Lynch',
      role: 'Alliance Manager, AMT',
      organisation: 'King’s College London',
      bio: 'First point of contact for companies and partners looking to work with the Mental Health Goals Programme.',
    },
    {
      order: 7,
      name: 'Eoin Gogarty',
      role: 'Database Lead, AMT',
      organisation: 'King’s College London',
    },
    {
      order: 8,
      name: 'Sidharth Sanjeev',
      role: 'Research Assistant, AMT',
      organisation: 'King’s College London',
    },
  ]

  await Promise.all(
    people.map((data) =>
      payload.create({
        collection: 'people',
        context: { disableRevalidate: true },
        data,
      }),
    ),
  )

  payload.logger.info(`— Seeding contact form...`)

  const contactForm = await payload.create({
    collection: 'forms',
    depth: 0,
    data: contactFormData,
  })

  payload.logger.info(`— Seeding pages...`)

  const pages: any[] = [
    // ——— Home ———
    {
      slug: 'home',
      _status: 'published',
      title: 'Home',
      hero: {
        type: 'highImpact',
        media: heroImageDoc.id,
        richText: root(
          heading('h1', text('Transforming mental health research in the UK')),
          paragraph(
            text(
              'The Mental Health Goals Programme is a £50 million Government-backed national programme — making the UK the global partner of choice for developing novel therapeutics for severe mental illness and neurodegenerative disorders, from experimental medicine to Phase III.',
            ),
          ),
        ),
        links: [
          {
            link: {
              type: 'custom',
              appearance: 'default',
              label: 'Explore the programme',
              url: '/about',
            },
          },
          {
            link: {
              type: 'custom',
              appearance: 'outline',
              label: 'Work with us',
              url: '/industry',
            },
          },
        ],
      },
      layout: [
        {
          blockType: 'stats',
          items: [
            {
              value: '£50M',
              label: 'Government investment',
              sublabel: 'over five years',
            },
            {
              value: '20,000',
              label: 'Additional genomic samples',
              sublabel: 'building on the GLAD Study',
            },
            {
              value: '6',
              label: 'National workstreams',
              sublabel: 'from discovery to delivery',
            },
          ],
        },
        {
          blockType: 'content',
          columns: [
            {
              size: 'twoThirds',
              richText: root(
                heading('h2', text('A cornerstone of the UK’s Life Sciences Sector Plan')),
                paragraph(
                  text(
                    'The programme harnesses the UK’s digital and data landscape to build the tools that guide priorities and planning across mental health research, trials, methodology and platforms — alongside the creation of clinically characterised, recontactable cohorts.',
                  ),
                ),
                paragraph(
                  text(
                    'It brings together experts, data assets, patients and the public into one joined-up, trusted system: a simple national structure for industry, better-designed trials, a new kind of partnership between patients and industry, and support for better policy and regulation.',
                  ),
                ),
              ),
            },
            {
              size: 'oneThird',
              richText: root(
                heading('h3', text('Our mission')),
                paragraph(
                  text(
                    'To make the UK the global partner of choice for developing and delivering novel therapeutics for severe mental illness and neurodegenerative disorders — while improving patient outcomes and driving economic growth.',
                  ),
                ),
              ),
            },
          ],
        },
        {
          blockType: 'workstreamsBlock',
          heading: 'Six national workstreams',
          intro:
            'Each workstream has a distinct role in the programme, spanning discovery to delivery across the UK’s leading institutions.',
          style: 'cards',
        },
        {
          blockType: 'content',
          columns: [
            {
              size: 'oneThird',
              richText: root(
                heading('h3', text('For industry')),
                paragraph(
                  text(
                    'A single front door to UK cohorts, data assets and trial expertise — with a wrap-around alliance service built for CROs, pharma, biotech and digital health.',
                  ),
                ),
              ),
              enableLink: true,
              link: {
                type: 'custom',
                appearance: 'default',
                label: 'Partner with us',
                url: '/industry',
              },
            },
            {
              size: 'oneThird',
              richText: root(
                heading('h3', text('For patients & the public')),
                paragraph(
                  text(
                    'Lived experience is embedded at the core of the programme — shaping priorities, governance and how data are used, with transparency at every step.',
                  ),
                ),
              ),
              enableLink: true,
              link: {
                type: 'custom',
                appearance: 'default',
                label: 'How we involve you',
                url: '/patients-public',
              },
            },
            {
              size: 'oneThird',
              richText: root(
                heading('h3', text('For researchers & clinicians')),
                paragraph(
                  text(
                    'National workstreams, methodology support and the world’s largest integrated mental health dataset — open to collaboration across the UK.',
                  ),
                ),
              ),
              enableLink: true,
              link: {
                type: 'custom',
                appearance: 'default',
                label: 'About the programme',
                url: '/about',
              },
            },
          ],
        },
        {
          blockType: 'cta',
          richText: root(
            heading('h3', text('Industry Engagement Forum — launching October 2026')),
            paragraph(
              text(
                'Join MHGP and global CROs, pharmaceutical and biotech partners for a day of strategic dialogue at Bush House, King’s College London.',
              ),
            ),
          ),
          links: [
            {
              link: {
                type: 'custom',
                appearance: 'default',
                label: 'Find out more',
                url: '/industry-engagement-forum',
              },
            },
          ],
        },
      ],
      meta: {
        title: 'Mental Health Goals Programme',
        description:
          'A £50M UK Government-backed national programme transforming mental health research — connecting industry, researchers, patients and the public.',
        image: heroImageDoc.id,
      },
    },

    // ——— About ———
    {
      slug: 'about',
      _status: 'published',
      title: 'About the programme',
      hero: {
        type: 'lowImpact',
        richText: root(
          heading('h1', text('About the programme')),
          paragraph(
            text(
              'A UK-wide commitment to transform mental health research and accelerate improved patient outcomes.',
            ),
          ),
        ),
      },
      layout: [
        {
          blockType: 'content',
          columns: [
            {
              size: 'full',
              richText: root(
                heading('h2', text('Why now')),
                paragraph(
                  text(
                    'Progress in developing new treatments in mental health has been slow. Recently, large companies and small innovators — in both the pharmacological and digital therapeutics space — have shown new interest in working in the UK, following promising results in mental health trials and the potential of digital approaches.',
                  ),
                ),
                paragraph(
                  text(
                    'But it is difficult for industry to work with the UK: the system is complicated, spread across many organisations, and not easy to navigate. Patients also want more say in how their data are used and what kinds of treatments are developed. The Mental Health Goals Programme brings everything together into one joined-up, trusted system.',
                  ),
                ),
                heading('h2', text('What we will do')),
                paragraph(
                  text(
                    'The programme brings together experts, data assets, patients and the public to: create a simple national structure to support entry into the UK (the Alliance Management Team); improve how mental health trials are designed and run (the Innovative Trials Hub); build a new kind of partnership between patients and industry (the Lived Experience Industry Partnership); and support better policy and regulation.',
                  ),
                ),
                paragraph(
                  text(
                    'Patients and the public benefit from more say in the trials that affect them and greater transparency in how data are used. Industry benefits from methods and tools for working in the UK, planning more successful trials, and stronger links with experts, data and the people who will benefit from new treatments. Together, this makes the UK a more competitive and attractive place for mental health research and trials.',
                  ),
                ),
                heading('h2', text('The world’s largest integrated mental health dataset')),
                paragraph(
                  text(
                    'Built on the GLAD (Genetic Links to Anxiety and Depression) Study, the programme combines biological and clinical data for psychosis and severe depression — with 20,000 additional deeply characterised genomic samples, and unique integration of multi-omics, AI and lived experience.',
                  ),
                ),
                heading('h2', text('Partners across the UK')),
                paragraph(
                  text(
                    'The programme is led from King’s College London and delivered with partners including the University of Oxford, University of Manchester, Swansea University, Cardiff University, Queen’s University Belfast, University of Edinburgh, University of Cambridge and Health Innovation Oxford & Thames Valley — a cornerstone of the Government’s 2025 Life Sciences Sector Plan.',
                  ),
                ),
              ),
            },
          ],
        },
        {
          blockType: 'cta',
          richText: root(
            heading('h3', text('Meet the team')),
            paragraph(
              text(
                'The leadership team spans clinical trials, neuroscience, philosophy, public health and lived experience.',
              ),
            ),
          ),
          links: [
            {
              link: {
                type: 'custom',
                appearance: 'default',
                label: 'Our people',
                url: '/people',
              },
            },
            {
              link: {
                type: 'custom',
                appearance: 'outline',
                label: 'The six workstreams',
                url: '/workstreams',
              },
            },
          ],
        },
      ],
      meta: {
        title: 'About',
        description:
          'Why the Mental Health Goals Programme exists, what it will do, and the partners delivering it across the UK.',
        image: cardTealDoc.id,
      },
    },

    // ——— Workstreams ———
    {
      slug: 'workstreams',
      _status: 'published',
      title: 'Workstreams',
      hero: {
        type: 'lowImpact',
        richText: root(
          heading('h1', text('Six workstreams, one mission')),
          paragraph(
            text(
              'Each workstream has a distinct role in the programme — together they span discovery to delivery.',
            ),
          ),
        ),
      },
      layout: [
        {
          blockType: 'workstreamsBlock',
          style: 'detailed',
        },
        {
          blockType: 'cta',
          richText: root(
            heading('h3', text('Want to work with a workstream?')),
            paragraph(
              text(
                'The Alliance Management Team will route you to the right people, data and infrastructure.',
              ),
            ),
          ),
          links: [
            {
              link: {
                type: 'custom',
                appearance: 'default',
                label: 'Get in touch',
                url: '/contact',
              },
            },
          ],
        },
      ],
      meta: {
        title: 'Workstreams',
        description:
          'The six national workstreams of the Mental Health Goals Programme, from the Alliance Management Team to Multi-omics.',
        image: cardTealDoc.id,
      },
    },

    // ——— For Industry ———
    {
      slug: 'industry',
      _status: 'published',
      title: 'For industry',
      hero: {
        type: 'lowImpact',
        richText: root(
          heading('h1', text('A single front door to UK mental health research')),
          paragraph(
            text(
              'For CROs, pharmaceutical companies, biotech and digital health innovators — of every size.',
            ),
          ),
        ),
      },
      layout: [
        {
          blockType: 'content',
          columns: [
            {
              size: 'full',
              richText: root(
                heading('h2', text('The Alliance Management Team')),
                paragraph(
                  text(
                    'Rather than relying on individual contacts and historical relationships, the AMT gives industry a clear national route into UK mental health research. It is a wrap-around service: linking companies with methodology expertise in trial design and delivery, the lived experience industry partnership, bespoke IP and royalty strategies, funding applications, and milestone and advisory board development.',
                  ),
                ),
                paragraph(
                  text(
                    'The team supports industry across the full spectrum of mental health diagnoses and psychiatric symptoms — including those experienced in neurological and neurodegenerative disorders and at the physical–mental health interface — and coordinates with the NIHR Innovation Service and the MRC Mental Health Platform to avoid duplication.',
                  ),
                ),
              ),
            },
          ],
        },
        {
          blockType: 'content',
          columns: [
            {
              size: 'oneThird',
              richText: root(
                heading('h3', text('Capabilities Database')),
                paragraph(
                  text(
                    'Finding the right UK mental health research cohort and site should take minutes, not months. A searchable national database of site capabilities — biomarkers, imaging, expertise, catchment — covering every UK site, to ensure equity of access to commercial trials and studies.',
                  ),
                ),
              ),
            },
            {
              size: 'oneThird',
              richText: root(
                heading('h3', text('Recruitment Simulator')),
                paragraph(
                  text(
                    'Model the incidence of target indications, biomarker data and bio-sample availability before costly commitments — built with the Data Observatory’s computational infrastructure, privacy preservation and governance frameworks.',
                  ),
                ),
              ),
            },
            {
              size: 'oneThird',
              richText: root(
                heading('h3', text('Founding Members Programme')),
                paragraph(
                  text(
                    'For larger pharmaceutical and technology companies: bespoke, rapid access to data and patient samples from the cohorts, and to the UK’s mental health expertise network.',
                  ),
                ),
              ),
            },
          ],
        },
        {
          blockType: 'cta',
          richText: root(
            heading('h3', text('Join us at the Industry Engagement Forum')),
            paragraph(
              text(
                'A strategic dialogue between MHGP and global CROs, pharmaceutical and biotech partners, ABPI and BIA — 8 October 2026, Bush House, London.',
              ),
            ),
          ),
          links: [
            {
              link: {
                type: 'custom',
                appearance: 'default',
                label: 'Forum details',
                url: '/industry-engagement-forum',
              },
            },
            {
              link: {
                type: 'custom',
                appearance: 'outline',
                label: 'Contact the AMT',
                url: '/contact',
              },
            },
          ],
        },
      ],
      meta: {
        title: 'For industry',
        description:
          'A single front door to UK mental health research: the Alliance Management Team, Capabilities Database, Recruitment Simulator and Founding Members Programme.',
        image: cardAmberDoc.id,
      },
    },

    // ——— Patients & Public ———
    {
      slug: 'patients-public',
      _status: 'published',
      title: 'Patients & public',
      hero: {
        type: 'lowImpact',
        richText: root(
          heading('h1', text('Lived experience at the heart of the programme')),
          paragraph(
            text('Research shaped with patients, families and the public — not just for them.'),
          ),
        ),
      },
      layout: [
        {
          blockType: 'content',
          columns: [
            {
              size: 'full',
              richText: root(
                heading('h2', text('A new kind of partnership')),
                paragraph(
                  text(
                    'Too often, treatments don’t address what patients actually want, research doesn’t include the groups most at risk, and people feel unheard about how their data are used. The Lived Experience Industry Partnership (LEIP) exists to change that — creating a new alliance between patients and industry that develops agreement on joint priorities.',
                  ),
                ),
                paragraph(
                  text(
                    'The partnership works to a clear set of principles: build on what already exists; learn from others; co-produce with people with lived experience, their families and the public alongside industry, clinicians and researchers; and ensure those underrepresented in research and at most risk of mental ill health are involved equitably.',
                  ),
                ),
                heading('h2', text('Your data, your say')),
                paragraph(
                  text(
                    'Public and patient trust is fundamental to a national data infrastructure. That means absolute transparency and clear communication about data pathways: what data are, where they go, and how they are stored, used and accessed.',
                  ),
                ),
                heading('h2', text('Get involved')),
                paragraph(
                  text(
                    'Communities of practice, deliberative dialogues and priority-setting partnerships all need people with lived experience of mental ill health — as patients, carers or family members. If you would like to take part, we would love to hear from you.',
                  ),
                ),
              ),
            },
          ],
        },
        {
          blockType: 'cta',
          richText: root(
            heading('h3', text('Help shape the future of mental health research')),
            paragraph(text('Register your interest in the Lived Experience Industry Partnership.')),
          ),
          links: [
            {
              link: {
                type: 'custom',
                appearance: 'default',
                label: 'Get in touch',
                url: '/contact',
              },
            },
          ],
        },
      ],
      meta: {
        title: 'Patients & public',
        description:
          'How the Mental Health Goals Programme embeds lived experience at its core — co-production, data transparency and ways to get involved.',
        image: cardTealDoc.id,
      },
    },

    // ——— Industry Engagement Forum ———
    {
      slug: 'industry-engagement-forum',
      _status: 'published',
      title: 'Industry Engagement Forum',
      hero: {
        type: 'mediumImpact',
        media: cardAmberDoc.id,
        richText: root(
          heading('h1', text('Industry Engagement Forum')),
          paragraph(
            text(
              'A strategic dialogue between MHGP and global CROs, pharmaceutical and biotech partners, ABPI and BIA — launching 8 October 2026 at Bush House, King’s College London.',
            ),
          ),
        ),
      },
      layout: [
        {
          blockType: 'content',
          columns: [
            {
              size: 'full',
              richText: root(
                paragraph(
                  text(
                    'The Industry Engagement Forum (IEF) is established to promote impactful collaboration between industry partners and the programmes, initiatives and workstreams of MHGP. The launch meeting brings everyone together for a single day of strategic dialogue: demonstrating the strengths of the UK mental health research ecosystem, identifying barriers to industry collaboration, and agreeing a roadmap for accelerating the development of novel therapeutics in severe mental illness and neurodegeneration.',
                  ),
                ),
              ),
            },
          ],
        },
        {
          blockType: 'eventDetails',
          facts: [
            { label: 'Date', value: '8 October 2026' },
            {
              label: 'Venue',
              value:
                'Bush House, King’s College London — Strand Campus, 30 Aldwych, London WC2B 4BG',
            },
            {
              label: 'Audience',
              value: 'Global CROs, pharmaceutical partners, biotech, ABPI and BIA',
            },
            { label: 'Duration', value: 'One day (five hours)' },
          ],
          agendaHeading: 'Agenda',
          agenda: [
            { time: '09:00', item: 'Welcome and introductions' },
            {
              time: '09:20',
              item: 'What is MHGP? Programme overview, vision, and how it fits national research priorities',
            },
            {
              time: '09:50',
              item: 'The UK opportunity — cohorts, data assets, NHS integration, regulatory environment and data-enabled discovery',
            },
            { time: '10:35', item: 'Coffee break' },
            {
              time: '10:50',
              item: 'Industry roundtable — strengths and challenges of running SMI and neurodegeneration trials in the UK',
            },
            {
              time: '12:00',
              item: 'Building earlier strategic partnerships — moving industry engagement upstream',
            },
            { time: '12:45', item: 'Working lunch & MHGP capabilities showcase' },
            {
              time: '13:15',
              item: 'Strategic planning workshop — shaping the UK value proposition and delivery model',
            },
            { time: '14:15', item: 'Agreeing the industry engagement strategy' },
            { time: '14:50', item: 'Closing — agreements and next steps' },
          ],
          outcomesHeading: 'What you’ll leave with',
          outcomes: [
            {
              title: 'A UK mental health value proposition',
              description:
                'A shared, one-page statement of what makes the UK the partner of choice for SMI and neurodegeneration R&D.',
            },
            {
              title: 'An agreed SWOT analysis',
              description: 'The UK’s position relative to other territories.',
            },
            {
              title: 'A top-10 list of industry barriers',
              description: 'Paired with practical, actionable solutions.',
            },
            {
              title: 'An industry engagement strategy (2027–2029)',
              description: 'A multi-year roadmap for deepening industry partnership.',
            },
            {
              title: 'A communication and engagement plan',
              description: 'Keeping momentum after the forum closes.',
            },
            {
              title: 'Named leads for CRO, pharma and biotech engagement',
              description: 'Clear points of contact going forward.',
            },
            {
              title: 'A 90-day action plan with named owners',
              description: 'Concrete, accountable next steps.',
            },
          ],
        },
        {
          blockType: 'cta',
          richText: root(
            heading('h3', text('Join the conversation')),
            paragraph(
              text(
                'To confirm your attendance or ask a question about the Industry Engagement Forum, get in touch with the Alliance Management Team.',
              ),
            ),
          ),
          links: [
            {
              link: {
                type: 'custom',
                appearance: 'default',
                label: 'Contact us',
                url: '/contact',
              },
            },
          ],
        },
      ],
      meta: {
        title: 'Industry Engagement Forum',
        description:
          'The MHGP Industry Engagement Forum launches 8 October 2026 at Bush House, King’s College London — agenda, audience and outcomes.',
        image: cardAmberDoc.id,
      },
    },

    // ——— People ———
    {
      slug: 'people',
      _status: 'published',
      title: 'People',
      hero: {
        type: 'lowImpact',
        richText: root(
          heading('h1', text('Leadership')),
          paragraph(
            text(
              'A team spanning clinical trials, neuroscience, philosophy, public health and lived experience.',
            ),
          ),
        ),
      },
      layout: [
        {
          blockType: 'peopleBlock',
        },
        {
          blockType: 'content',
          columns: [
            {
              size: 'full',
              richText: root(
                paragraph(
                  text(
                    'The programme’s wider leadership includes co-leads and collaborators across the University of Liverpool, University of Manchester, University of Oxford and Health Innovation Oxford & Thames Valley — with governance connecting all six workstreams through the MHG Programme Steering Committee.',
                  ),
                ),
              ),
            },
          ],
        },
      ],
      meta: {
        title: 'People',
        description: 'The leadership team of the Mental Health Goals Programme.',
        image: cardTealDoc.id,
      },
    },

    // ——— Contact ———
    {
      slug: 'contact',
      _status: 'published',
      title: 'Contact',
      hero: {
        type: 'lowImpact',
        richText: root(
          heading('h1', text('Contact us')),
          paragraph(
            text(
              'Whether you are a company exploring the UK, a researcher, or someone with lived experience who wants to get involved — we would love to hear from you.',
            ),
          ),
        ),
      },
      layout: [
        {
          blockType: 'content',
          columns: [
            {
              size: 'half',
              richText: root(
                heading('h3', text('Prof. Mitul Mehta')),
                paragraph(text('Lead, Alliance Management Team')),
                paragraph(link('mitul.mehta@kcl.ac.uk', 'mailto:mitul.mehta@kcl.ac.uk')),
              ),
            },
            {
              size: 'half',
              richText: root(
                heading('h3', text('Eric Lynch')),
                paragraph(text('Alliance Manager, Alliance Management Team')),
                paragraph(link('eric.lynch@kcl.ac.uk', 'mailto:eric.lynch@kcl.ac.uk')),
              ),
            },
          ],
        },
        {
          blockType: 'formBlock',
          enableIntro: true,
          form: contactForm.id,
          introContent: root(
            heading('h3', text('Send us a message')),
            paragraph(
              text('Fill in the form below and the Alliance Management Team will get back to you.'),
            ),
          ),
        },
      ],
      meta: {
        title: 'Contact',
        description:
          'Get in touch with the Mental Health Goals Programme Alliance Management Team.',
        image: cardTealDoc.id,
      },
    },

    // ——— Accessibility statement ———
    // DRAFT — square-bracket placeholders must be completed and the statement
    // reviewed by the team before go-live.
    {
      slug: 'accessibility',
      _status: 'published',
      title: 'Accessibility statement',
      hero: {
        type: 'lowImpact',
        richText: root(
          heading('h1', text('Accessibility statement')),
          paragraph(
            text(
              'This accessibility statement applies to mentalhealthgoals.co.uk, the website of the Mental Health Goals Programme.',
            ),
          ),
        ),
      },
      layout: [
        {
          blockType: 'content',
          columns: [
            {
              size: 'full',
              richText: root(
                heading('h2', text('Our commitment')),
                paragraph(
                  text(
                    'We want as many people as possible to be able to use this website. That means, for example, that you should be able to:',
                  ),
                ),
                bullets(
                  [text('navigate the whole site using only a keyboard')],
                  [text('zoom in up to 300% without the text spilling off the screen')],
                  [text('listen to the site using a screen reader')],
                  [text('understand every image through its text alternative')],
                ),
                paragraph(
                  text(
                    'We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA, in line with the Public Sector Bodies (Websites and Mobile Applications) (No. 2) Accessibility Regulations 2018.',
                  ),
                ),
                heading('h2', text('Conformance status')),
                paragraph(
                  text(
                    'This website has not yet undergone a full accessibility audit. We are working towards WCAG 2.2 level AA conformance and will update this statement when the audit is complete.',
                  ),
                ),
                heading('h2', text('Feedback and contact')),
                paragraph(
                  text(
                    'If you find a problem that is not listed here, or if you need information from this website in a different format, please contact us at ',
                  ),
                  link(
                    'enquiries@mentalhealthgoals.co.uk',
                    'mailto:enquiries@mentalhealthgoals.co.uk',
                  ),
                  text('. We aim to respond within [X] working days.'),
                ),
                heading('h2', text('Enforcement procedure')),
                paragraph(
                  text(
                    'The Equality and Human Rights Commission enforces the accessibility regulations. If you are not happy with how we respond to a complaint, contact the ',
                  ),
                  link(
                    'Equality Advisory and Support Service (EASS)',
                    'https://www.equalityadvisoryservice.com/',
                    true,
                  ),
                  text('.'),
                ),
                paragraph(
                  bold(
                    'This statement was prepared on [date] and will be reviewed before the site launches.',
                  ),
                ),
              ),
            },
          ],
        },
      ],
      meta: {
        title: 'Accessibility statement',
        description: 'The accessibility statement for the Mental Health Goals Programme website.',
        image: cardTealDoc.id,
      },
    },

    // ——— Privacy notice ———
    // DRAFT — the data controller, retention period and DPO details must be
    // confirmed with KCL information compliance before go-live.
    {
      slug: 'privacy',
      _status: 'published',
      title: 'Privacy notice',
      hero: {
        type: 'lowImpact',
        richText: root(
          heading('h1', text('Privacy notice')),
          paragraph(
            text(
              'How the Mental Health Goals Programme collects and uses personal information on this website.',
            ),
          ),
        ),
      },
      layout: [
        {
          blockType: 'content',
          columns: [
            {
              size: 'full',
              richText: root(
                heading('h2', text('Who we are')),
                paragraph(
                  text(
                    'The Mental Health Goals Programme is a UK research programme led from King’s College London with partner institutions across the UK. For the purposes of UK data protection law, the data controller for this website is [confirm: King’s College London].',
                  ),
                ),
                heading('h2', text('The information we collect')),
                paragraph(
                  text(
                    'When you use the contact form we collect your name, email address, telephone number (if you provide it) and the content of your message. Our hosting providers also keep short-lived technical logs (such as IP addresses) to run and secure the service.',
                  ),
                ),
                paragraph(
                  text('This website does not use analytics, advertising or tracking cookies.'),
                ),
                heading('h2', text('How we use it')),
                paragraph(
                  text(
                    'We use the information you send us to respond to your enquiry and, where relevant, to manage follow-up conversations about the programme. Our lawful basis is our legitimate interest in responding to enquiries sent to us. We do not sell your information or use it for marketing.',
                  ),
                ),
                heading('h2', text('Where it is stored and for how long')),
                paragraph(
                  text(
                    'Enquiries are stored securely with our website hosting and email providers and are accessible only to the programme team. We keep contact-form enquiries for [confirm retention period, e.g. 12 months] and then delete them.',
                  ),
                ),
                heading('h2', text('Your rights')),
                paragraph(text('Under UK data protection law you have the right to:')),
                bullets(
                  [text('ask for a copy of the information we hold about you')],
                  [text('ask us to correct or delete your information')],
                  [text('object to or restrict how we use it')],
                  [text('complain to the Information Commissioner’s Office (ICO)')],
                ),
                paragraph(
                  text('To exercise any of these rights, contact us at '),
                  link(
                    'enquiries@mentalhealthgoals.co.uk',
                    'mailto:enquiries@mentalhealthgoals.co.uk',
                  ),
                  text(
                    ' or the King’s College London data protection team at [confirm DPO contact]. You can reach the ICO at ',
                  ),
                  link('ico.org.uk', 'https://ico.org.uk/', true),
                  text('.'),
                ),
                paragraph(
                  bold(
                    'This notice was last updated on [date] and will be reviewed before the site launches.',
                  ),
                ),
              ),
            },
          ],
        },
      ],
      meta: {
        title: 'Privacy notice',
        description:
          'How the Mental Health Goals Programme handles personal information on this website.',
        image: cardTealDoc.id,
      },
    },
  ]

  const createdPages = await Promise.all(
    pages.map((data) =>
      payload.create({
        collection: 'pages',
        context: { disableRevalidate: true },
        depth: 0,
        data,
      }),
    ),
  )

  payload.logger.info(`— Seeding posts...`)

  const postAuthor = req.user?.id
    ? req.user.id
    : (await payload.find({ collection: 'users', limit: 1 })).docs[0]?.id

  const post1 = await payload.create({
    collection: 'posts',
    depth: 0,
    context: { disableRevalidate: true },
    data: {
      slug: 'a-50-million-commitment-to-transform-mental-health-research',
      _status: 'published',
      title: 'A £50 million commitment to transform mental health research',
      heroImage: cardTealDoc.id,
      categories: [newsCategory.id],
      authors: postAuthor ? [postAuthor] : [],
      publishedAt: '2026-07-01T09:00:00.000Z',
      content: root(
        paragraph(
          text(
            'The Mental Health Goals Programme is a cornerstone of the Government’s 2025 Life Sciences Sector Plan: a £50 million investment over five years to transform mental health research and accelerate improved patient outcomes.',
          ),
        ),
        paragraph(
          text(
            'The programme harnesses the UK’s digital and data landscape to build tools that guide priorities and planning across mental health research, trials, methodology and platforms — alongside the creation of clinically characterised, recontactable cohorts, including 20,000 additional genomic samples building on the GLAD Study.',
          ),
        ),
        heading('h2', text('Six workstreams, one system')),
        paragraph(
          text(
            'Six national workstreams — the Alliance Management Team, Innovative Trials Hub, Lived Experience Industry Partnership, Digital Innovation, Data Observatory and Multi-omics — connect discovery to delivery across King’s College London, Oxford, Manchester, Swansea, Cardiff, Belfast, Edinburgh and Cambridge.',
          ),
        ),
        paragraph(link('Read more about the programme', '/about'), text('.')),
      ),
      meta: {
        title: 'A £50 million commitment to transform mental health research',
        description:
          'The Mental Health Goals Programme is a cornerstone of the Government’s 2025 Life Sciences Sector Plan.',
        image: cardTealDoc.id,
      },
    },
  })

  const post2 = await payload.create({
    collection: 'posts',
    depth: 0,
    context: { disableRevalidate: true },
    data: {
      slug: 'mhgp-launches-its-industry-engagement-forum',
      _status: 'published',
      title: 'MHGP launches its Industry Engagement Forum',
      heroImage: cardAmberDoc.id,
      categories: [eventsCategory.id],
      authors: postAuthor ? [postAuthor] : [],
      publishedAt: '2026-08-05T09:00:00.000Z',
      content: root(
        paragraph(
          text(
            'On 8 October 2026, the Mental Health Goals Programme will launch its Industry Engagement Forum at Bush House, King’s College London — bringing together global CROs, pharmaceutical and biotech partners, the ABPI and the BIA for a single day of strategic dialogue.',
          ),
        ),
        paragraph(
          text(
            'The forum will demonstrate the strengths of the UK mental health research ecosystem, identify barriers to industry collaboration, and agree a roadmap for accelerating the development of novel therapeutics in severe mental illness and neurodegeneration.',
          ),
        ),
        paragraph(
          link('See the full agenda and register your interest', '/industry-engagement-forum'),
          text('.'),
        ),
      ),
      meta: {
        title: 'MHGP launches its Industry Engagement Forum',
        description:
          'The MHGP Industry Engagement Forum launches 8 October 2026 at Bush House, King’s College London.',
        image: cardAmberDoc.id,
      },
    },
  })

  await payload.update({
    id: post1.id,
    collection: 'posts',
    context: { disableRevalidate: true },
    data: { relatedPosts: [post2.id] },
  })
  await payload.update({
    id: post2.id,
    collection: 'posts',
    context: { disableRevalidate: true },
    data: { relatedPosts: [post1.id] },
  })

  payload.logger.info(`— Seeding globals...`)

  const navLinks = [
    { label: 'About', url: '/about' },
    { label: 'Workstreams', url: '/workstreams' },
    { label: 'For industry', url: '/industry' },
    { label: 'Patients & public', url: '/patients-public' },
    { label: 'News & events', url: '/posts' },
    { label: 'People', url: '/people' },
    { label: 'Contact', url: '/contact' },
  ]

  await Promise.all([
    payload.updateGlobal({
      slug: 'header',
      context: { disableRevalidate: true },
      data: {
        navItems: navLinks.map(({ label, url }) => ({
          link: { type: 'custom' as const, label, url },
        })),
      },
    }),
    payload.updateGlobal({
      slug: 'footer',
      context: { disableRevalidate: true },
      data: {
        navItems: [
          ...navLinks.map(({ label, url }) => ({
            link: { type: 'custom' as const, label, url },
          })),
          {
            link: {
              type: 'custom' as const,
              label: 'Industry Engagement Forum',
              url: '/industry-engagement-forum',
            },
          },
          {
            link: {
              type: 'custom' as const,
              label: 'Accessibility',
              url: '/accessibility',
            },
          },
          {
            link: {
              type: 'custom' as const,
              label: 'Privacy',
              url: '/privacy',
            },
          },
        ],
      },
    }),
  ])

  payload.logger.info(
    `Seeded database successfully! Created ${createdPages.length} pages, ${workstreams.length} workstreams, ${people.length} people and 2 posts.`,
  )
}

function localFile(name: string): File {
  // Resolve relative to this file when run via `pnpm seed`, or from the project
  // root when the code has been bundled (e.g. the admin Seed button in dev)
  const candidates = [
    path.resolve(dirname, name),
    path.resolve(process.cwd(), 'src/endpoints/seed', name),
  ]
  const filePath = candidates.find((candidate) => fs.existsSync(candidate))

  if (!filePath) {
    throw new Error(`Seed asset not found: ${name}`)
  }

  const data = fs.readFileSync(filePath)

  return {
    name,
    data,
    mimetype: 'image/webp',
    size: data.byteLength,
  }
}
