/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CollectionSlug, GlobalSlug, Payload, PayloadRequest, File } from 'payload'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { contactForm as contactFormData } from './contact-form'
import { registerInterestForm as registerInterestFormData } from './register-interest-form'
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
    // Media goes through the collection operation, not the db adapter: file
    // deletion runs in the collection's delete hooks, so a db-level wipe
    // strands every uploaded file. Locally those strays then make each
    // filename "taken" and the next seed uploads eric-lynch-1, -2, -3...;
    // on Vercel Blob they overwrite silently but orphan any old size that is
    // no longer generated. Everything else stays db-level for speed.
    if (collection === 'media') {
      await payload.delete({ collection, depth: 0, req, where: {} })
    } else {
      await payload.db.deleteMany({ collection, req, where: {} })
    }
  }

  for (const collection of collections) {
    if (payload.collections[collection].config.versions) {
      await payload.db.deleteVersions({ collection, req, where: {} })
    }
  }

  payload.logger.info(`— Seeding media...`)

  const [heroImageDoc, cardTealDoc, cardAmberDoc, mehtaPhotoDoc, lynchPhotoDoc] = await Promise.all(
    [
      payload.create({
        collection: 'media',
        data: {
          alt: 'The Mental Health Goals ridge — contour lines rising to a twin summit on a deep petrol ground',
        },
        file: localFile('mhg-hero.png'),
      }),
      payload.create({
        collection: 'media',
        data: {
          alt: 'The Mental Health Goals ridge — contour lines rising to a twin summit, on a petrol ground',
        },
        file: localFile('mhg-card-teal.png'),
      }),
      payload.create({
        collection: 'media',
        data: {
          alt: 'The Mental Health Goals ridge drawn in amber — contour lines rising to a twin summit on a deep petrol ground',
        },
        file: localFile('mhg-card-amber.png'),
      }),
      payload.create({
        collection: 'media',
        data: { alt: 'Professor Mitul Mehta' },
        file: localFile('images/mitul-mehta.jpg'),
      }),
      payload.create({
        collection: 'media',
        data: { alt: 'Eric Lynch' },
        file: localFile('images/eric-lynch.jpg'),
      }),
    ],
  )

  // Team headshots, each from the person's own institutional or programme
  // profile — provenance and licence status in images/SOURCES.md. People
  // without an entry here render as initials until a photo is supplied.
  const teamPhotoFiles: Record<string, { alt: string; file: string }> = {
    'Prof. Husseini Manji': { alt: 'Professor Husseini Manji', file: 'husseini-manji.jpg' },
    'Dr Vaibhav Narayan': { alt: 'Dr Vaibhav Narayan', file: 'vaibhav-narayan.jpg' },
    'Prof. Richard Emsley': { alt: 'Professor Richard Emsley', file: 'richard-emsley.jpg' },
    'Dr Siân Rees': { alt: 'Dr Siân Rees', file: 'sian-rees.jpg' },
    'Eoin Gogarty': { alt: 'Eoin Gogarty', file: 'eoin-gogarty.jpg' },
    'Prof. Gerome Breen': { alt: 'Professor Gerome Breen', file: 'gerome-breen.jpg' },
    'Prof. Ann John': { alt: 'Professor Ann John', file: 'ann-john.jpg' },
    'Prof. Rob Stewart': { alt: 'Professor Rob Stewart', file: 'rob-stewart.jpg' },
    'Dr Pauline Whelan': { alt: 'Dr Pauline Whelan', file: 'pauline-whelan.jpg' },
  }
  const teamPhotos: Record<string, number> = {}
  for (const [personName, { alt, file }] of Object.entries(teamPhotoFiles)) {
    const doc = await payload.create({
      collection: 'media',
      data: { alt },
      file: localFile(`images/${file}`),
    })
    teamPhotos[personName] = doc.id
  }

  payload.logger.info(`— Seeding categories...`)

  const [newsCategory, eventsCategory, explainerCategory] = await Promise.all([
    payload.create({
      collection: 'categories',
      data: { title: 'News', slug: 'news' },
    }),
    payload.create({
      collection: 'categories',
      data: { title: 'Events', slug: 'events' },
    }),
    payload.create({
      collection: 'categories',
      data: { title: 'Explainers', slug: 'explainers' },
    }),
  ])

  payload.logger.info(`— Seeding workstreams...`)

  const workstreams = [
    {
      number: 1,
      title: 'Alliance Management Team',
      slug: 'alliance-management-team',
      group: 'digit' as const,
      summary:
        'A single, simple front door bringing industry into UK mental health research and trials.',
      description:
        'The AMT is a wrap-around service for industry — linking companies with methodology expertise in trial design and delivery, the lived experience partnership, bespoke IP and royalty strategies, funding applications and advisory board development. It provides a seamless structure that is simple to navigate for companies of every size, complementing the NIHR Innovation Service and the MRC Mental Health Platform.',
      deliveredBy: 'King’s College London',
      resources: [
        {
          label: 'Mental Health Goals on GOV.UK',
          url: 'https://www.gov.uk/government/publications/life-sciences-healthcare-goals/mental-health-goals',
        },
        {
          label: 'The £50 million announcement',
          url: 'https://www.gov.uk/government/news/50-million-boost-for-groundbreaking-mental-health-research',
        },
      ],
    },
    {
      number: 2,
      title: 'Innovative Clinical Trials Hub',
      slug: 'innovative-trials-hub',
      group: 'digit' as const,
      summary: 'Designs and delivers precision psychiatry trials with industry.',
      description:
        'The Innovative Clinical Trials Hub (ITH) provides statistical and methodological expertise in the design and analysis of precision psychiatry studies, from early-phase biomarker-guided designs through adaptive Phase 2 and 3 trials — plus the infrastructure for multi-arm multi-stage platform studies delivered at scale in primary and community settings.',
      deliveredBy: 'King’s College London',
      resources: [
        {
          label: 'NIHR Mental Health Translational Research Collaboration',
          url: 'https://www.nihr.ac.uk/about-us/what-we-do/infrastructure/translational-research-collaborations/mental-health',
        },
      ],
    },
    {
      number: 3,
      title: 'Lived Experience Industry Partnership',
      slug: 'lived-experience-industry-partnership',
      group: 'digit' as const,
      summary: 'Establishes patient experience as central to industry priorities.',
      description:
        'The LEIP creates a new alliance between patients and industry — joint priority setting, deliberative dialogues and communities of practice that align what patients want with what industry develops, and rebalance power between patients, research and industry.',
      deliveredBy: 'University of Oxford',
      resources: [
        {
          label: 'Mental Health Goals on GOV.UK',
          url: 'https://www.gov.uk/government/publications/life-sciences-healthcare-goals/mental-health-goals',
        },
      ],
    },
    {
      number: 4,
      title: 'Digital Innovation',
      slug: 'digital-innovation',
      summary: 'Helps digital health technology launch, adopt and scale in the NHS.',
      description:
        'The Digital Innovation workstream supports digital health technologies through launch, adoption and scale in the NHS — creating clear pathways for digital therapeutics and measurement tools to reach the people who need them.',
      deliveredBy: 'University of Manchester',
      resources: [{ label: 'Mental Health Digital Innovation (MHDI)', url: 'https://www.mhdi.uk' }],
    },
    {
      number: 5,
      title: 'Data Observatory',
      slug: 'data-observatory',
      summary: 'An industry-facing platform for trial feasibility and AI-driven analytics.',
      description:
        'Delivered with DATAMIND — the UK Hub for Mental Health Informatics Research Development — the Data Observatory provides feasibility and protocol-design services over UK-wide data assets, supporting site selection, recruitment planning and AI-driven analytics inside secure data environments.',
      deliveredBy: 'University of Manchester · Swansea University',
      resources: [
        {
          label: 'DATAMIND — Hub for Mental Health Informatics Research',
          url: 'https://datamind.org.uk/',
        },
      ],
    },
    {
      number: 6,
      title: 'Multi-omics',
      slug: 'multi-omics',
      summary:
        'A world-first multi-omics resource across 20,000 deeply clinically characterised participants.',
      description:
        'In severe depression, led from King’s College London, building on the GLAD (Genetic Links to Anxiety and Depression) Study. In psychosis, led from Cardiff University’s Centre for Neuropsychiatric Genetics and Genomics with the Universities of Cambridge and Edinburgh, which also leads multi-omic data generation. Together: biological and clinical data at unprecedented depth.',
      deliveredBy:
        'King’s College London · Cardiff University · Queen’s University Belfast · University of Edinburgh · University of Cambridge',
      resources: [
        { label: 'The GLAD Study', url: 'https://gladstudy.org.uk/' },
        {
          label: 'Centre for Neuropsychiatric Genetics and Genomics, Cardiff',
          url: 'https://www.cardiff.ac.uk/centre-neuropsychiatric-genetics-genomics',
        },
      ],
    },
  ]

  const createdWorkstreams = await Promise.all(
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

  /** Workstream id by slug, for the People ↔ Workstreams relationships below. */
  const wsId = Object.fromEntries(
    createdWorkstreams.map((doc) => [doc.slug as string, doc.id]),
  ) as Record<string, number>

  payload.logger.info(`— Seeding team...`)

  // Team, ordered as it appears on the Team page.
  //
  // Structure follows the DIGIT grant application (APP97536, "Mental Health
  // Goals Programme — Data and Digital Industry Alliance Team") and the
  // programme contacts workbook: DIGIT is the funded project that delivers the
  // Alliance Management Team, Innovative Clinical Trials Hub and Lived
  // Experience Industry Partnership, so its lead and co-leads are their own
  // section, and the cohort, data and digital workstream leads their own.
  //
  // Deliberately NOT published from the internal contacts workbook: email
  // addresses, executive assistants, university operations staff, and external
  // stakeholders whose involvement is not already public on GOV.UK.
  const people = [
    // ——— Programme leadership ———
    {
      order: 1,
      group: 'leadership' as const,
      name: 'Prof. Kathryn Abel',
      role: 'Co-Chair, Mental Health Goals Programme',
      organisation: 'University of Manchester',
      profileUrl: 'https://research.manchester.ac.uk/en/persons/kathryn.m.abel',
      bio: 'Professor of Psychological Medicine and Director of the Centre for Women’s Mental Health at the University of Manchester, and Honorary Consultant Psychiatrist with Greater Manchester Mental Health NHS Trust. An NIHR Senior Investigator, European Research Council Fellow and elected Fellow of the Academy of Medical Sciences.',
    },
    {
      order: 2,
      group: 'leadership' as const,
      name: 'Prof. Husseini Manji',
      role: 'Co-Chair, Mental Health Goals Programme',
      organisation: 'University of Oxford',
      profileUrl: 'https://www.psych.ox.ac.uk/team/husseini-manji',
      bio: 'Professor at the University of Oxford, previously Global Therapeutic Head for Neuroscience at Janssen R&D and Global Head, Science for Minds, at Johnson & Johnson. Formerly Chief of the Laboratory of Molecular Pathophysiology at the US National Institutes of Health and Director of the NIH Mood and Anxiety Disorders Programme.',
    },
    {
      order: 3,
      group: 'leadership' as const,
      name: 'Dr Vaibhav Narayan',
      role: 'Chief Industry, Data Science and Digital Health Officer · Alliance Management Team Co-Lead',
      organisation: 'Mental Health Goals Programme',
      workstreams: [wsId['alliance-management-team']],
      bio: 'Over 20 years of leadership in data science, digital health and pharmaceutical R&D, including 13 years at Johnson & Johnson as Vice President of Data Sciences and Digital Health. Earlier senior roles include Head of Discovery Informatics at Eli Lilly and Director of Computational Sciences at Celera Genomics, where his team helped sequence the human genome.',
    },

    // ——— DIGIT leadership ———
    {
      order: 10,
      group: 'digit' as const,
      name: 'Prof. Mitul Mehta',
      role: 'DIGIT Lead · Alliance Management Team Co-Lead',
      organisation: 'King’s College London',
      photo: mehtaPhotoDoc.id,
      profileUrl: 'https://www.kcl.ac.uk/people/mitul-mehta',
      workstreams: [wsId['alliance-management-team']],
      bio: 'Professor of Neuroimaging & Psychopharmacology and Director of the Centre for Innovative Therapeutics at King’s College London. Leads the Experimental Medicine & Novel Therapeutics theme at the NIHR-Maudsley Biomedical Research Centre.',
    },
    {
      order: 11,
      group: 'digit' as const,
      name: 'Prof. Richard Emsley',
      role: 'DIGIT Co-Lead · Innovative Clinical Trials Hub Lead',
      organisation: 'King’s College London',
      profileUrl: 'https://www.kcl.ac.uk/people/richard-emsley',
      workstreams: [wsId['innovative-trials-hub']],
      bio: 'NIHR Research Professor and Professor of Medical Statistics and Trials Methodology at the IoPPN. Academic Director of King’s Clinical Trials Unit and Theme Lead for Trials, Genomics and Prediction in the NIHR Maudsley BRC.',
    },
    {
      order: 12,
      group: 'digit' as const,
      name: 'Dr Siân Rees',
      role: 'DIGIT Co-Lead · Lived Experience Industry Partnership Co-Lead (Practice)',
      organisation: 'Health Innovation Oxford & Thames Valley',
      workstreams: [wsId['lived-experience-industry-partnership']],
      bio: 'Director of Community Involvement and Workforce Innovation, with a background in public health medicine and a decade in mental health policy at the Department of Health.',
    },
    {
      order: 13,
      group: 'digit' as const,
      name: 'Prof. Edward Harcourt',
      role: 'DIGIT Co-Lead · Lived Experience Industry Partnership Co-Lead (Concepts)',
      organisation: 'University of Oxford',
      profileUrl: 'https://www.philosophy.ox.ac.uk/people/edward-harcourt',
      workstreams: [wsId['lived-experience-industry-partnership']],
      bio: 'Professor of Philosophy at the University of Oxford. Academic Lead for Patient and Public Involvement in the Oxford Health BRC and the Mental Health Translational Research Collaboration.',
    },
    {
      order: 14,
      group: 'digit' as const,
      name: 'Prof. Paula Williamson',
      role: 'DIGIT Co-Lead · Innovative Clinical Trials Hub Co-Investigator',
      organisation: 'University of Liverpool',
      workstreams: [wsId['innovative-trials-hub']],
      bio: 'Professor of Medical Statistics at the University of Liverpool, bringing trials methodology and core outcome set expertise to the programme’s trial design work.',
    },
    {
      order: 15,
      group: 'digit' as const,
      name: 'Dr Matthias Pierce',
      role: 'DIGIT Co-Lead · Alliance Management Team Co-Investigator',
      organisation: 'University of Manchester',
      profileUrl: 'https://research.manchester.ac.uk/en/persons/matthias.pierce',
      workstreams: [wsId['alliance-management-team'], wsId['data-observatory']],
      bio: 'Biostatistician and Senior Research Fellow at the Centre for Women’s Mental Health, University of Manchester, and a lead on the programme’s data observatory work.',
    },

    // ——— Delivery team ———
    {
      order: 20,
      group: 'delivery' as const,
      name: 'Eric Lynch',
      role: 'Alliance Manager',
      organisation: 'King’s College London',
      photo: lynchPhotoDoc.id,
      workstreams: [wsId['alliance-management-team']],
      bio: 'First point of contact for companies and partners looking to work with the Mental Health Goals Programme.',
    },
    {
      order: 21,
      group: 'delivery' as const,
      name: 'Non Hill',
      role: 'Lived Experience Lead',
      organisation: 'Health Innovation Oxford & Thames Valley',
      workstreams: [wsId['lived-experience-industry-partnership']],
      bio: 'Brings over a decade of lived experience as a carer, professional lived experience roles across Healthwatch Surrey and Surrey and Borders Partnership NHS Foundation Trust, and a previous decade as a research neuroscientist in the pharmaceutical industry.',
    },
    {
      order: 22,
      group: 'delivery' as const,
      name: 'Dr Kerrie McGiveron',
      role: 'Research and Innovation Associate, Innovative Clinical Trials Hub',
      organisation: 'University of Liverpool',
      workstreams: [wsId['innovative-trials-hub']],
      bio: 'Methodology project coordinator for the trials hub, working across the programme’s trial design and delivery partners.',
    },
    {
      order: 23,
      group: 'delivery' as const,
      name: 'Eoin Gogarty',
      role: 'Research Fellow (Database Lead)',
      organisation: 'King’s College London',
      workstreams: [wsId['alliance-management-team']],
      bio: 'Builds the capabilities database behind the programme’s offer to industry.',
    },
    {
      order: 24,
      group: 'delivery' as const,
      name: 'Sidharth Sanjeev',
      role: 'Research Assistant',
      organisation: 'King’s College London',
      workstreams: [wsId['alliance-management-team']],
    },

    // ——— Workstream leads ———
    {
      order: 30,
      group: 'workstream-leads' as const,
      name: 'Prof. Gerome Breen',
      role: 'GLAD Study Lead and Principal Investigator',
      organisation: 'King’s College London',
      profileUrl: 'https://www.kcl.ac.uk/people/gerome-breen',
      workstreams: [wsId['multi-omics']],
      bio: 'Professor of Psychiatric Genetics at King’s College London, leading the severe depression cohort built on the GLAD Study with Queen’s University Belfast and the University of Edinburgh.',
    },
    {
      order: 31,
      group: 'workstream-leads' as const,
      name: 'Prof. James Walters',
      role: 'Director, Centre for Neuropsychiatric Genetics and Genomics',
      organisation: 'Cardiff University',
      workstreams: [wsId['multi-omics']],
      bio: 'Leads the psychosis cohort with the Universities of Cambridge and Edinburgh, and multi-omic data generation across the programme’s cohorts.',
    },
    {
      order: 32,
      group: 'workstream-leads' as const,
      name: 'Prof. Ann John',
      role: 'DATAMIND Co-Director',
      organisation: 'Swansea University',
      profileUrl: 'https://www.swansea.ac.uk/staff/a.john/',
      workstreams: [wsId['data-observatory']],
      bio: 'Professor of Public Health and Psychiatry, Health Data Science at Swansea University, leading the programme’s work on secure, centralised and scalable mental health data.',
    },
    {
      order: 33,
      group: 'workstream-leads' as const,
      name: 'Prof. Rob Stewart',
      role: 'DATAMIND Co-Director',
      organisation: 'King’s College London',
      profileUrl: 'https://www.kcl.ac.uk/people/professor-robert-stewart',
      workstreams: [wsId['data-observatory']],
      bio: 'Professor of Psychiatric Epidemiology and Clinical Informatics at the IoPPN, and Clinical and Population Informatics Lead at the NIHR Maudsley Biomedical Research Centre.',
    },
    {
      order: 34,
      group: 'workstream-leads' as const,
      name: 'Dr Pauline Whelan',
      role: 'DATAMIND Digitally Enhanced Trials Lead',
      organisation: 'University of Manchester',
      profileUrl: 'https://research.manchester.ac.uk/en/persons/pauline.whelan',
      workstreams: [wsId['digital-innovation']],
      bio: 'Honorary Senior Research Fellow in Digital Health at the University of Manchester and Chief Operating Officer at CareLoop Health, working on digital adoption pathways for the NHS.',
    },
    {
      order: 35,
      group: 'workstream-leads' as const,
      name: 'Dr Trina Histon',
      role: 'Health Psychologist and Digital Health Strategist',
      organisation: 'Percolating Health',
      workstreams: [wsId['digital-innovation']],
      bio: 'Director of Percolating Health, working with the programme on how digital mental health tools reach the people who need them.',
    },
  ]

  await Promise.all(
    people.map((data) =>
      payload.create({
        collection: 'people',
        context: { disableRevalidate: true },
        data: { ...data, photo: teamPhotos[data.name] ?? data.photo },
      }),
    ),
  )

  payload.logger.info(`— Seeding forms...`)

  const registerInterestForm = await payload.create({
    collection: 'forms',
    depth: 0,
    data: registerInterestFormData,
  })

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
              'The Mental Health Goals Programme (MHG) is a £50 million Government-backed, UK-wide programme — making the UK the global partner of choice for developing novel therapeutics for severe mental illness and neurodegenerative disorders, from experimental medicine to Phase III.',
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
              sublabel: 'across depression and psychosis cohorts',
            },
            {
              value: '6',
              label: 'UK-wide workstreams',
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
                    'It brings together experts, data assets, patients and the public into one joined-up, trusted system: a simple UK-wide structure for industry, better-designed trials, a new kind of partnership between patients and industry, and support for better policy and regulation.',
                  ),
                ),
                paragraph(
                  text('The programme overview is published on '),
                  link(
                    'GOV.UK',
                    'https://www.gov.uk/government/publications/life-sciences-healthcare-goals/mental-health-goals',
                    true,
                  ),
                  text('.'),
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
          heading: 'Six UK-wide workstreams',
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
                    'Six UK-wide workstreams, methodology support and the world’s largest integrated mental health dataset — open to collaboration across the UK.',
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
                'Join MHG and global CROs, pharmaceutical, digital and biotech partners for a day of strategic dialogue at the SGDP Centre, Denmark Hill Campus, King’s College London.',
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
          'A £50 million UK Government-backed programme transforming mental health research across the UK — connecting industry, researchers, patients and the public.',
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
                heading('h2', text('What is MHG?')),
                paragraph(
                  text(
                    'The Mental Health Goals Programme (MHG) is a cornerstone of the Government’s 2025 ',
                  ),
                  link(
                    'Life Sciences Sector Plan',
                    'https://www.gov.uk/government/publications/life-sciences-sector-plan',
                    true,
                  ),
                  text(
                    '. MHG harnesses the UK’s digital and data landscape to build the tools that guide priorities and planning across mental health research, trials, methodology and platforms — alongside the creation of clinically characterised, recontactable cohorts.',
                  ),
                ),
                heading('h3', text('Strategic priorities')),
                bullets(
                  [
                    bold('A UK-wide government commitment'),
                    text(
                      ' — £50 million to transform mental health research and accelerate improved patient outcomes.',
                    ),
                  ],
                  [
                    bold('New innovative alliances'),
                    text(
                      ' — an industry alliance and trials methodology lead ensuring impactful interaction between industry, patients and researchers, with lived experience embedded at its core.',
                    ),
                  ],
                  [
                    bold('The world’s largest integrated mental health dataset'),
                    text(
                      ' — combining biological and clinical data across severe depression and psychosis cohorts.',
                    ),
                  ],
                  [
                    bold('Unique multi-omics, AI and lived experience integration'),
                    text(' — enabling the next generation of personalised treatments.'),
                  ],
                  [
                    bold('Finding the right cohort and site in minutes, not months'),
                    text(' — the DIGIT Capabilities Database makes that possible.'),
                  ],
                ),
                heading('h2', text('The challenge we’re solving')),
                paragraph(
                  text(
                    'Large companies and small innovators alike — in both the pharmacological and digital therapeutics space — have shown new interest in working in the UK, following promising results in mental health trials and the potential of digital approaches. But it is difficult for industry to work with the UK: the system is complicated, spread across many organisations, and not easy to navigate. Patients also want more say in how their data are used and what kinds of treatments are developed. MHG brings everything together into one joined-up, trusted system.',
                  ),
                ),
                paragraph(
                  text('Mental health problems carry an extremely large burden of disease — '),
                  link(
                    '1 in 4 people in England',
                    'https://www.mind.org.uk/information-support/types-of-mental-health-problems/mental-health-facts-and-statistics/',
                    true,
                  ),
                  text(
                    ' experience a mental health problem each year — while a sustained withdrawal of commercial investment has left few new treatments on the horizon. Advances in genetics, neuroscience, imaging and data science mean now is the time to translate research into patient benefit.',
                  ),
                ),
                heading('h2', text('Precision psychiatry')),
                paragraph(
                  text(
                    'Precision psychiatry uses personal data — such as genomics, brain scans and lifestyle — to better understand an individual’s condition and personalise treatment. For years, patients have said that existing treatments fail to address their most pressing symptoms, cause significant long-term unwanted effects, or diminish quality of life. The programme backs a new approach: one that focuses on the most disabling symptoms, identified by people with lived experience, rather than relying on broad diagnostic labels.',
                  ),
                ),
                heading('h2', text('What we will do')),
                paragraph(
                  text(
                    'MHG brings together experts, data assets, patients and the public to: create a simple UK-wide structure to support entry into the UK (the Alliance Management Team); improve how mental health trials are designed and run (the Innovative Clinical Trials Hub); build a new kind of partnership between patients and industry (the Lived Experience Industry Partnership); and support better policy and regulation.',
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
                    'The programme is building two cohorts, together adding 20,000 deeply characterised genomic samples. In severe depression, the work is led from King’s College London, building on the ',
                  ),
                  link(
                    'GLAD (Genetic Links to Anxiety and Depression) Study',
                    'https://gladstudy.org.uk/',
                    true,
                  ),
                  text('. In psychosis, it is led from Cardiff University’s '),
                  link(
                    'Centre for Neuropsychiatric Genetics and Genomics',
                    'https://www.cardiff.ac.uk/centre-neuropsychiatric-genetics-genomics',
                    true,
                  ),
                  text(
                    ' with the Universities of Cambridge and Edinburgh, which also leads multi-omic data generation across the cohort. Both strands are integrated with multi-omics, AI and lived experience.',
                  ),
                ),
                heading('h2', text('Funded by government, delivered UK-wide')),
                paragraph(
                  text('The programme is investing '),
                  link(
                    '£50 million over five years',
                    'https://www.gov.uk/government/news/50-million-boost-for-groundbreaking-mental-health-research',
                    true,
                  ),
                  text(', funded by the '),
                  link(
                    'Office for Life Sciences',
                    'https://www.gov.uk/government/organisations/office-for-life-sciences',
                    true,
                  ),
                  text(' and delivered by the '),
                  link(
                    'Medical Research Council (MRC)',
                    'https://www.ukri.org/councils/mrc/',
                    true,
                  ),
                  text(
                    '. It is co-chaired by Professor Kathryn Abel and Professor Husseini Manji, with Dr Vaibhav Narayan as Chief Industry, Data Science and Digital Health Officer. The full programme overview is published on ',
                  ),
                  link(
                    'GOV.UK',
                    'https://www.gov.uk/government/publications/life-sciences-healthcare-goals/mental-health-goals',
                    true,
                  ),
                  text('.'),
                ),
                heading('h2', text('The wider programme family')),
                paragraph(
                  text(
                    'MHG sits within a family of government investments in mental health research. The Mental Health Mission, launched in May 2023 with a ',
                  ),
                  link(
                    '£42.7 million investment',
                    'https://www.nihr.ac.uk/news/427-million-funding-boost-for-mental-health-research/33559',
                    true,
                  ),
                  text(' in clinical research centres delivered through the '),
                  link(
                    'NIHR Mental Health Translational Research Collaboration',
                    'https://www.nihr.ac.uk/about-us/what-we-do/infrastructure/translational-research-collaborations/mental-health',
                    true,
                  ),
                  text(' — including the '),
                  link(
                    'Mental Health Research for Innovation Centre (M-RIC)',
                    'https://mric.uk/',
                    true,
                  ),
                  text(' in Liverpool and the '),
                  link(
                    'Mental Health Mission Midlands Translational Centre',
                    'https://www.birmingham.ac.uk/research/mental-health/themes/mhmtc/index.aspx',
                    true,
                  ),
                  text(
                    ' in Birmingham, and a network of mood-disorder research clinics across the UK. The Mission has its own leadership — chaired by Professor Rachel Upthegrove of the University of Oxford, with Professor Jeremy Hall of Cardiff University as deputy chair — and its own remit; the two programmes are designed to complement one another.',
                  ),
                ),
                paragraph(
                  text('In May 2024 the programme invested in '),
                  link('DATAMIND', 'https://datamind.org.uk/', true),
                  text(
                    ' — the Hub for Mental Health Informatics Research Development — and in July 2024 an Innovative Clinical Trials Hub was launched to develop infrastructure for innovative clinical trials and a collaborative partnership for industry. Digital adoption activity is published on the ',
                  ),
                  link(
                    'Mental Health Digital Innovation (MHDI) website',
                    'https://www.mhdi.uk',
                    true,
                  ),
                  text('.'),
                ),
                heading('h2', text('Partners across the UK')),
                paragraph(
                  text(
                    'The programme is led from King’s College London — where DIGIT, the Data and Digital Industry Alliance Team, delivers the Alliance Management Team, Innovative Clinical Trials Hub and Lived Experience Industry Partnership — and is delivered with partners spanning all four UK nations: the University of Oxford, University of Manchester, Swansea University, Cardiff University, Queen’s University Belfast, University of Edinburgh, University of Cambridge and Health Innovation Oxford & Thames Valley.',
                  ),
                ),
                paragraph(
                  text(
                    'The full programme overview, including who we are working with, is published on ',
                  ),
                  link(
                    'GOV.UK',
                    'https://www.gov.uk/government/publications/life-sciences-healthcare-goals/mental-health-goals',
                    true,
                  ),
                  text('.'),
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
                label: 'Our team',
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
              'Each workstream has a distinct role in the programme — together they span discovery to delivery. The first three are delivered by DIGIT, the Data and Digital Industry Alliance Team at King’s College London.',
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
          'The six UK-wide workstreams of the Mental Health Goals Programme, from the Alliance Management Team to Multi-omics.',
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
                    'Rather than relying on individual contacts and historical relationships, the Alliance Management Team (AMT) gives industry a clear UK-wide route into mental health research. It is a wrap-around service: linking companies with methodology expertise in trial design and delivery, the lived experience industry partnership, bespoke IP and royalty strategies, funding applications, and milestone and advisory board development.',
                  ),
                ),
                paragraph(
                  text(
                    'The team supports industry across the full spectrum of mental health diagnoses and psychiatric symptoms — including those experienced in neurological and neurodegenerative disorders and at the physical–mental health interface — and coordinates with the ',
                  ),
                  link('NIHR', 'https://www.nihr.ac.uk', true),
                  text(' Innovation Service and the '),
                  link('MRC', 'https://www.ukri.org/councils/mrc/', true),
                  text(' Mental Health Platform to avoid duplication.'),
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
                heading('h3', text('DIGIT Capabilities Database')),
                paragraph(
                  text(
                    'Finding the right UK mental health research cohort and site should take minutes, not months. A searchable UK-wide database of site capabilities — biomarkers, imaging, expertise, catchment — covering every UK site, to ensure equity of access to commercial trials and studies.',
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
                'A strategic dialogue between MHG and global CROs, pharmaceutical and digital industry partners, biotech organisations, ABPI and ABHI — 8 October 2026, Denmark Hill Campus, King’s College London.',
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
                    'Public and patient trust is fundamental to a UK-wide data infrastructure. That means absolute transparency and clear communication about data pathways: what data are, where they go, and how they are stored, used and accessed. The programme’s cohorts build on the ',
                  ),
                  link(
                    'GLAD (Genetic Links to Anxiety and Depression) Study',
                    'https://gladstudy.org.uk/',
                    true,
                  ),
                  text(', whose volunteers have already shaped how this research is done.'),
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
              'A strategic dialogue between MHG and global CROs, pharmaceutical and digital industry partners, biotech organisations, ABPI and ABHI — launching 8 October 2026 at the SGDP Centre, Denmark Hill Campus, King’s College London.',
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
                    'The Industry Engagement Forum (IEF) is established to promote impactful collaboration between industry partners and the programmes, initiatives and workstreams of the Mental Health Goals Programme (MHG) — alongside trade associations ',
                  ),
                  link('ABPI', 'https://www.abpi.org.uk', true),
                  text(' and '),
                  link('ABHI', 'https://www.abhi.org.uk', true),
                  text(
                    '. This launch meeting will establish a strategic dialogue with industry, demonstrate the strengths of the UK mental health research ecosystem, identify barriers to collaboration, and provide input for a roadmap for accelerating novel therapeutics in severe mental illness (SMI) and neurodegeneration.',
                  ),
                ),
                paragraph(
                  text(
                    'The forum is convened by DIGIT — the Data and Digital Industry Alliance Team at King’s College London, which delivers the programme’s Alliance Management Team, Innovative Clinical Trials Hub and Lived Experience Industry Partnership.',
                  ),
                ),
                heading('h2', text('Getting there')),
                paragraph(
                  text(
                    'The SGDP Centre is on King’s College London’s Denmark Hill Campus (SE5 8AF). The fastest route is a direct train to Denmark Hill from Victoria or Blackfriars (under 15 minutes). Buses 40, 68, 468, 176 and 185 also serve the campus, and a taxi from central London is about 30 minutes. See the ',
                  ),
                  link(
                    'Denmark Hill campus map',
                    'https://www.kcl.ac.uk/visit/denmark-hill-campus',
                    true,
                  ),
                  text('.'),
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
                heading('h3', text('Convened by DIGIT')),
                paragraph(
                  text(
                    'The Data and Digital Industry Alliance Team at King’s College London, which delivers the programme’s Alliance Management Team, Innovative Clinical Trials Hub and Lived Experience Industry Partnership.',
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
              value: 'SGDP Centre, Denmark Hill Campus, King’s College London, SE5 8AF',
            },
            {
              label: 'Audience',
              value:
                'Global CROs, pharmaceutical and digital industry partners, biotech organisations, ABPI and ABHI',
            },
            {
              label: 'Timing',
              value: '10:00–16:00 (business breakfast from 09:30)',
            },
          ],
          agendaHeading: 'Agenda',
          agenda: [
            { time: '09:30', item: 'Business breakfast' },
            {
              time: '10:00',
              item: 'Session 1: Introductions and UK Landscape — Prof. Mitul Mehta on introductions and objectives; Prof. Husseini Manji on the UK landscape (strengths and challenges); then Q&A',
            },
            { time: '10:50', item: 'Coffee / tea break' },
            {
              time: '11:10',
              item: 'Session 2: MHG Programme Overview — the new UK opportunity (Chair: Prof. Kathryn Abel). Workstream leads introduce their areas:',
            },
            { item: 'Industry Alliance Management Team — Prof. Mitul Mehta' },
            { item: 'Innovative Clinical Trials Hub — Prof. Richard Emsley' },
            { item: 'Lived Experience Industry Partnership — Dr Siân Rees' },
            { item: 'Cohorts and -omics — Prof. James Walters / Gerome Breen' },
            { item: 'Digital Innovations — Dr Pauline Whelan' },
            { item: 'Data and SDEs — Prof. Ann John' },
            { item: 'Data Observatory — Dr Matthias Pierce' },
            {
              time: '12:20',
              item: 'Symbiotic partnering with industry — exploring how UK mental health research and industry can build genuinely symbiotic partnerships to accelerate progress (speaker TBC)',
            },
            { time: '12:40', item: 'Lunch' },
            {
              time: '13:20',
              item: 'Session 3: Industry roundtable (Chair: Prof. Vaibhav Narayan) — strengths and weaknesses of conducting Phase I–III studies in SMI and neurodegeneration, and the opportunity for the UK to strengthen its position globally',
            },
            {
              time: '14:10',
              item: 'Session 4: Building earlier strategic partnerships (Chairs: Prof. Richard Emsley and Dr Siân Rees) — navigating from service provider to strategic partnership with global pharma and digital health',
            },
            {
              time: '15:00',
              item: 'Industry Engagement Forum launch — Profs. Vaibhav Narayan and Mitul Mehta: review of objectives, initial next steps and priority actions',
            },
            { time: '15:30', item: 'Next steps' },
            { time: '15:45', item: 'Closing remarks and reflections — Trevor Jones' },
          ],
          outcomesHeading: 'Outputs from this meeting',
          outcomes: [
            {
              title: 'An agreed SWOT analysis',
              description:
                'A shared view of the strengths, weaknesses, opportunities and threats of conducting Phase I–III studies in SMI and neurodegeneration in the UK.',
            },
            {
              title: 'Top 10 industry barriers and solutions',
              description: 'A prioritised list of what blocks collaboration — and how to fix it.',
            },
            {
              title: 'Agreed priority actions and next steps',
              description:
                'Immediate actions, ownership and follow-up working groups, refined with live input from attendees.',
            },
          ],
        },
        {
          blockType: 'content',
          columns: [
            {
              size: 'full',
              richText: root(
                heading('h2', text('Looking ahead')),
                paragraph(
                  text(
                    'Later forum meetings will build on this launch day to develop a one-page UK mental health value proposition, an industry engagement strategy for 2027–2029, a communication and stakeholder engagement plan, named leads for CRO, pharma and biotech engagement, and a 90-day action plan with owners.',
                  ),
                ),
              ),
            },
          ],
        },
        {
          // `blockName` becomes the block's id, so the sticky bar below can
          // send people to #register without leaving the page.
          blockName: 'Register',
          blockType: 'formBlock',
          form: registerInterestForm.id,
          enableIntro: true,
          introContent: root(
            heading('h2', text('Register your interest')),
            paragraph(
              text(
                'Places at the launch meeting are limited and allocated by the Alliance Management Team. Tell us who you are and we will confirm your place and send joining details.',
              ),
            ),
          ),
        },
        {
          blockType: 'cta',
          richText: root(
            heading('h3', text('Questions about the Forum?')),
            paragraph(
              text(
                'The Alliance Management Team can talk through the agenda, the audience or how your organisation might take part.',
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
      stickyCta: {
        enabled: true,
        message: 'Forum — 8 October 2026, King’s College London',
        label: 'Register your interest',
        href: '#register',
      },
      meta: {
        title: 'Industry Engagement Forum',
        description:
          'The MHG Industry Engagement Forum launches 8 October 2026 at the SGDP Centre, Denmark Hill Campus, King’s College London — agenda, audience and outcomes.',
        image: cardAmberDoc.id,
      },
    },

    // ——— People ———
    {
      slug: 'people',
      _status: 'published',
      title: 'Team',
      hero: {
        type: 'lowImpact',
        richText: root(
          heading('h1', text('The team')),
          paragraph(
            text(
              'Programme leadership, workstream leads and the Alliance Management Team — spanning clinical trials, genetics, neuroscience, philosophy, health data science, digital health and lived experience.',
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
                    'Governance connects all six workstreams through the MHG Programme Steering Committee, with further co-leads and collaborators across partner institutions in all four UK nations. Full details of who we are working with are published on ',
                  ),
                  link(
                    'GOV.UK',
                    'https://www.gov.uk/government/publications/life-sciences-healthcare-goals/mental-health-goals',
                    true,
                  ),
                  text('.'),
                ),
              ),
            },
          ],
        },
      ],
      meta: {
        title: 'Team',
        description:
          'The people delivering the Mental Health Goals Programme: leadership, workstream leads and the Alliance Management Team.',
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
                heading('h2', text('Work with the programme')),
                paragraph(
                  text(
                    'For industry partnerships, research collaboration or lived experience involvement, the Alliance Management Team is the front door:',
                  ),
                ),
                paragraph(
                  link(
                    'enquiries@mentalhealthgoals.co.uk',
                    'mailto:enquiries@mentalhealthgoals.co.uk',
                  ),
                ),
              ),
            },
            {
              size: 'half',
              richText: root(
                heading('h2', text('Policy enquiries')),
                paragraph(
                  text(
                    'For policy questions about the Mental Health Goals Programme, contact the Office for Life Sciences:',
                  ),
                ),
                paragraph(
                  link(
                    'mentalhealthgoals@officeforlifesciences.gov.uk',
                    'mailto:mentalhealthgoals@officeforlifesciences.gov.uk',
                  ),
                ),
              ),
            },
          ],
        },
        {
          blockType: 'formBlock',
          enableIntro: true,
          form: contactForm.id,
          introContent: root(
            heading('h2', text('Send us a message')),
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
                    'This website was last self-assessed on 21 August 2026 against WCAG 2.2 level AA, using automated testing (axe-core) of every page in both light and dark colour schemes together with manual keyboard-navigation checks. No failures were found, and these checks now run automatically on every change to the site. Automated and keyboard testing cannot detect every barrier, so we treat this as a partial assessment: a fuller evaluation, including screen-reader testing, is planned, and we will update this statement as it develops.',
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
                  text('. We aim to respond within 10 working days.'),
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
                    'The Mental Health Goals Programme is a UK research programme led from King’s College London with partner institutions across the UK. For the purposes of UK data protection law, the data controller for this website is King’s College London.',
                  ),
                ),
                heading('h2', text('The information we collect')),
                paragraph(
                  text(
                    'When you use the contact form we collect your name, email address, telephone number (if you provide it) and the content of your message. Our hosting providers also keep short-lived technical logs (such as IP addresses) to run and secure the service.',
                  ),
                ),
                paragraph(
                  text(
                    'When you register your interest in the Industry Engagement Forum we collect your name, organisation, role, email address and whether you intend to attend. You can also tell us about access or dietary requirements. That box is optional, and anything you write in it may reveal information about your health, a disability or your beliefs, so please share only what you want us to act on.',
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
                paragraph(
                  text(
                    'Forum registrations are used to allocate places, plan the day and contact you about it. Where you tell us about access or dietary requirements, we use that only to make the arrangements you have asked for, and share it with the venue and caterers only so far as it takes to do so.',
                  ),
                ),
                heading('h2', text('Where it is stored and for how long')),
                paragraph(
                  text(
                    'Enquiries are stored securely with our website hosting and email providers and are accessible only to the programme team. We keep contact-form enquiries for 12 months and then delete them.',
                  ),
                ),
                paragraph(
                  text(
                    'Forum registrations are kept for 12 months after the event so that we can follow up on what came out of it. Access and dietary requirements are deleted once the event has taken place.',
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
                    ' or the King’s College London Information Compliance team — which includes the university’s Data Protection Officer — at ',
                  ),
                  link('info-compliance@kcl.ac.uk', 'mailto:info-compliance@kcl.ac.uk'),
                  text('. King’s explains its own approach in its '),
                  link('Core Privacy Notice', 'https://www.kcl.ac.uk/terms/privacy', true),
                  text('. You can reach the ICO at '),
                  link('ico.org.uk', 'https://ico.org.uk/', true),
                  text('.'),
                ),
                // Operator statement (the footer's copyright names the programme,
                // which is not a legal entity) and the OGL attribution required
                // for the GOV.UK material adapted on About and in the articles.
                // The licence permits attribution on a linked page rather than
                // inline, so it lives here instead of cluttering the footer.
                heading('h2', text('About this website')),
                paragraph(
                  text(
                    'This website is operated by King’s College London on behalf of the Mental Health Goals Programme partners. Some pages adapt material published on GOV.UK — contains public sector information licensed under the ',
                  ),
                  link(
                    'Open Government Licence v3.0',
                    'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
                    true,
                  ),
                  text('.'),
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
      publishedAt: '2026-07-01T09:00:00.000Z',
      content: root(
        paragraph(
          text(
            'The Mental Health Goals Programme (MHG) is a cornerstone of the Government’s 2025 ',
          ),
          link(
            'Life Sciences Sector Plan',
            'https://www.gov.uk/government/publications/life-sciences-sector-plan',
            true,
          ),
          text(': a '),
          link(
            '£50 million investment over five years',
            'https://www.gov.uk/government/news/50-million-boost-for-groundbreaking-mental-health-research',
            true,
          ),
          text(
            ' to transform mental health research and accelerate improved patient outcomes. It is funded by the Office for Life Sciences and delivered by the ',
          ),
          link('Medical Research Council', 'https://www.ukri.org/councils/mrc/', true),
          text('.'),
        ),
        paragraph(
          text(
            'MHG harnesses the UK’s digital and data landscape to build tools that guide priorities and planning across mental health research, trials, methodology and platforms — alongside the creation of clinically characterised, recontactable cohorts, including 20,000 additional genomic samples across severe depression and psychosis.',
          ),
        ),
        heading('h2', text('Six workstreams, one system')),
        paragraph(
          text(
            'Six UK-wide workstreams — the Alliance Management Team, Innovative Clinical Trials Hub, Lived Experience Industry Partnership, Digital Innovation, Data Observatory and Multi-omics — connect discovery to delivery across King’s College London, Oxford, Manchester, Swansea, Cardiff, Belfast, Edinburgh and Cambridge. The first three are delivered by DIGIT, the Data and Digital Industry Alliance Team at King’s College London.',
          ),
        ),
        paragraph(link('Read more about the programme', '/about'), text('.')),
        paragraph(
          text('Source: '),
          link(
            'Mental Health Goals on GOV.UK',
            'https://www.gov.uk/government/publications/life-sciences-healthcare-goals/mental-health-goals',
            true,
          ),
          text('.'),
        ),
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
      slug: 'mhg-launches-its-industry-engagement-forum',
      _status: 'published',
      title: 'MHG launches its Industry Engagement Forum',
      // The teal card, not the amber one: post heroes crop to roughly 2:1, which
      // lifts the amber goal to the very top of the frame and sits it behind the
      // navigation. The amber card is kept for the Forum page, where it is shown
      // uncropped and the goal is the point.
      heroImage: cardTealDoc.id,
      categories: [eventsCategory.id],
      publishedAt: '2026-08-05T09:00:00.000Z',
      content: root(
        paragraph(
          text(
            'On 8 October 2026, the Mental Health Goals Programme (MHG) will launch its Industry Engagement Forum at the SGDP Centre, Denmark Hill Campus, King’s College London — bringing together global CROs, pharmaceutical and digital industry partners, biotech organisations, the ABPI and ABHI for a single day of strategic dialogue.',
          ),
        ),
        paragraph(
          text(
            'The forum will demonstrate the strengths of the UK mental health research ecosystem, identify barriers to industry collaboration, and provide input for a roadmap for accelerating novel therapeutics in severe mental illness and neurodegeneration.',
          ),
        ),
        paragraph(
          link('See the full agenda and register your interest', '/industry-engagement-forum'),
          text('.'),
        ),
      ),
      meta: {
        title: 'MHG launches its Industry Engagement Forum',
        description:
          'The MHG Industry Engagement Forum launches 8 October 2026 at the SGDP Centre, Denmark Hill Campus, King’s College London.',
        image: cardAmberDoc.id,
      },
    },
  })

  // Retrospectives and explainers. These are published with the current date
  // rather than backdated to the events they describe — the programme's site
  // did not exist then, and dating them honestly avoids implying a publishing
  // history that never happened. Every factual claim carries its source link.
  const articles = [
    {
      slug: 'mhg-and-the-mental-health-mission',
      title: 'MHG and the Mental Health Mission: how they fit together',
      category: newsCategory.id,
      image: cardTealDoc.id,
      description:
        'Two programmes, two remits, one aim — a short guide to how the Mental Health Goals Programme and the Mental Health Mission relate.',
      content: root(
        paragraph(
          text('Launched in May 2023, the Mental Health Mission committed '),
          link(
            '£42.7 million',
            'https://www.nihr.ac.uk/news/427-million-funding-boost-for-mental-health-research/33559',
            true,
          ),
          text(
            ' to clinical research centres across the UK, delivered through the National Institute for Health and Care Research’s ',
          ),
          link(
            'Mental Health Translational Research Collaboration',
            'https://www.nihr.ac.uk/about-us/what-we-do/infrastructure/translational-research-collaborations/mental-health',
            true,
          ),
          text(
            ' — a network of investigators specialising in mental health research, chaired by Professor Rachel Upthegrove with Professor Jeremy Hall as deputy chair.',
          ),
        ),
        heading('h2', text('What the Mission does')),
        paragraph(
          text('More than £20 million established two demonstrator sites: the '),
          link('Mental Health Research for Innovation Centre', 'https://mric.uk/', true),
          text(
            ' in Liverpool, which works on how mental, physical and social conditions interlink, and the ',
          ),
          link(
            'Mental Health Mission Midlands Translational Centre',
            'https://www.birmingham.ac.uk/research/mental-health/themes/mhmtc/index.aspx',
            true,
          ),
          text(
            ' in Birmingham, which supports research into novel treatments for early intervention in psychosis, depression, and children and young people. The Mission also runs a ',
          ),
          link(
            'network of 15 mood-disorder research clinics',
            'https://www.nihr.ac.uk/node/66916',
            true,
          ),
          text(
            ', sited in areas of the UK with the highest levels of depression, for people with difficult-to-treat depression.',
          ),
        ),
        heading('h2', text('Two remits, designed to complement')),
        paragraph(
          text(
            'The Mental Health Goals Programme (MHG) has a different remit within the same family of investments: a UK-wide front door for industry, trials design and methodology, a new partnership between patients and industry, and cohort and data infrastructure. In the programme’s own words, its work focuses on challenges not addressed elsewhere — each programme with its own leadership, each designed to complement the other. ',
          ),
          link('Read how MHG is organised', '/about'),
          text('.'),
        ),
      ),
    },
    {
      slug: 'datamind-and-the-programmes-data-infrastructure',
      title: 'DATAMIND and the programme’s data infrastructure',
      category: newsCategory.id,
      image: cardTealDoc.id,
      description:
        'The UK Hub for Mental Health Informatics Research Development underpins how MHG makes data available to researchers and industry.',
      content: root(
        paragraph(
          text('In May 2024 the Mental Health Goals Programme invested in '),
          link('DATAMIND', 'https://datamind.org.uk/', true),
          text(
            ' — the UK Hub for Mental Health Informatics Research Development. DATAMIND brings together data services, tools and expertise for mental health research across the four nations, working with the NHS, universities, charities, research institutes and industry.',
          ),
        ),
        heading('h2', text('Who leads it')),
        // People never link out — at most to their card on the Team page
        // (institutions may). See tests/unit/editorialLinks.spec.ts.
        paragraph(
          text('DATAMIND is led by Co-Directors '),
          link('Professor Ann John', '/people#ann-john'),
          text(' of Swansea University and '),
          link('Professor Rob Stewart', '/people#rob-stewart'),
          text(
            ' of King’s College London, who between them cover population health data science and clinical informatics.',
          ),
        ),
        heading('h2', text('How it connects to the Data Observatory')),
        paragraph(
          text('MHG’s '),
          link('Data Observatory', '/workstreams/data-observatory'),
          text(
            ' is delivered with DATAMIND: an industry-facing layer over UK-wide data assets that answers feasibility and protocol-design questions — site selection, recruitment planning, AI-driven analytics — inside secure data environments, without moving patient data.',
          ),
        ),
      ),
    },
    {
      slug: 'what-is-precision-psychiatry',
      title: 'What is precision psychiatry?',
      category: explainerCategory.id,
      image: cardTealDoc.id,
      description:
        'Using personal data — genomics, brain scans, lifestyle — to understand an individual’s condition and personalise their treatment.',
      content: root(
        paragraph(
          text(
            'Precision psychiatry is an approach to mental health treatment that uses personal data — such as genomics, brain scans and lifestyle — to better understand an individual’s condition, and to personalise treatment so it is more likely to work.',
          ),
        ),
        heading('h2', text('Why the current approach falls short')),
        paragraph(
          text(
            'Mental health conditions are usually diagnosed and treated by identifying broad symptom patterns. For years, patients have said that existing treatments fail to address their most pressing symptoms, often cause significant long-term unwanted effects or withdrawal symptoms, and diminish their quality of life. Broad diagnostic labels can also overlook the specific symptoms people find most disabling.',
          ),
        ),
        heading('h2', text('What a different approach looks like')),
        paragraph(
          text(
            'MHG backs an approach that starts from the most disabling symptoms, identified by people with lived experience, rather than from diagnostic categories alone. That requires deeply characterised cohorts, multi-omic and clinical data at scale, and lived experience embedded in how research questions are set — which is what the programme’s workstreams exist to build.',
          ),
        ),
        paragraph(
          text('Source: '),
          link(
            'Mental Health Goals on GOV.UK',
            'https://www.gov.uk/government/publications/life-sciences-healthcare-goals/mental-health-goals',
            true,
          ),
          text('. '),
          link('How lived experience shapes the programme', '/patients-public'),
          text('.'),
        ),
      ),
    },
    {
      slug: 'building-the-worlds-largest-mental-health-multi-omics-dataset',
      title: 'Building the world’s largest mental health multi-omics dataset',
      category: explainerCategory.id,
      image: cardAmberDoc.id,
      description:
        'Severe depression and psychosis: two cohorts, 20,000 deeply characterised genomic samples.',
      content: root(
        paragraph(
          text(
            'MHG is creating a nationally representative multi-omics resource across 20,000 deeply clinically characterised participants, built as two strands covering the conditions where the need for new treatments is most acute.',
          ),
        ),
        heading('h2', text('Severe depression')),
        paragraph(
          text(
            'Led from King’s College London by Professor Gerome Breen, this strand builds on the ',
          ),
          link(
            'GLAD (Genetic Links to Anxiety and Depression) Study',
            'https://gladstudy.org.uk/',
            true,
          ),
          text(
            ' — one of the largest cohorts of its kind, whose volunteers have already shaped how this research is done — with partners at Queen’s University Belfast and the University of Edinburgh.',
          ),
        ),
        heading('h2', text('Psychosis')),
        paragraph(
          text('Led from Cardiff University by Professor James Walters, Director of the '),
          link(
            'Centre for Neuropsychiatric Genetics and Genomics',
            'https://www.cardiff.ac.uk/centre-neuropsychiatric-genetics-genomics',
            true,
          ),
          text(
            ', with the Universities of Cambridge and Edinburgh. Multi-omic data generation across the whole cohort is led from Cardiff.',
          ),
        ),
        heading('h2', text('Why multi-omics')),
        paragraph(
          text(
            'Combining genomic, epigenomic, proteomic and metabolomic data with clinical phenotypes and health records lets researchers look for the biological signatures behind the symptoms people actually experience — the foundation for biomarker discovery, stratified trials and, eventually, treatments matched to individuals.',
          ),
        ),
        paragraph(
          link('More about the Multi-omics workstream', '/workstreams/multi-omics'),
          text('.'),
        ),
      ),
    },
  ]

  const createdArticles = await Promise.all(
    articles.map((article) =>
      payload.create({
        collection: 'posts',
        depth: 0,
        context: { disableRevalidate: true },
        data: {
          slug: article.slug,
          _status: 'published',
          title: article.title,
          heroImage: article.image,
          categories: [article.category],
          publishedAt: new Date().toISOString(),
          content: article.content,
          meta: {
            title: article.title,
            description: article.description,
            image: article.image,
          },
        },
      }),
    ),
  )

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
    { label: 'Team', url: '/people' },
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
              newTab: true,
              label: 'Mental Health Goals on GOV.UK',
              url: 'https://www.gov.uk/government/publications/life-sciences-healthcare-goals/mental-health-goals',
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
    `Seeded database successfully! Created ${createdPages.length} pages, ${workstreams.length} workstreams, ${people.length} people and ${createdArticles.length + 2} posts.`,
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
  const extension = name.split('.').pop()?.toLowerCase()
  const mimetype =
    extension === 'png' ? 'image/png' : extension === 'jpg' ? 'image/jpeg' : 'image/webp'

  return {
    name,
    data,
    mimetype,
    size: data.byteLength,
  }
}
