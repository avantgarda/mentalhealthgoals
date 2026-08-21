/**
 * Workstream detail content, transcribed from MHG_boundary_positions1.xlsx
 * (compiled Aug 2026). Shared by the seed and the backfill migration.
 *
 * Editorial notes on the transcription:
 *  - "Rough - " draft prefixes removed from two boundary statements (ITH, LEIP)
 *  - one typo fixed: "How do me make" → "How do we make" (AMT)
 *  - spaces before question marks removed; apostrophes normalised to ’
 *  - the last three sheet columns (networking, tools, team members) are
 *    internal and deliberately not imported
 *
 * REVIEW STATUS: the sheet's own annotation (column A) reads "Have only
 * included suggestions; respective workstream team to EDIT final." — i.e.
 * ALL of this content is draft copy pending sign-off by each workstream
 * team. Edit in the admin (Workstreams collection) before launch.
 */
export const workstreamContent: Record<
  string,
  {
    boundaryStatement: string
    primaryFocus: string[]
    keyQuestions: string[]
    differentiators: string[]
  }
> = {
  'alliance-management-team': {
    boundaryStatement:
      'The AMT uses expertise in data, digital and pharma and strong linkage to trials methodology, lived experience and expertise to bring research and trials into the UK across the MH spectrum\n\nBrings Industry In',
    primaryFocus: [
      'Understanding barriers to working with UK',
      'Developing alliances and partnerships with industry',
      'Creating tools to support an improved landscape for planning studies and trials with various partners',
    ],
    keyQuestions: [
      'How do we make planning studies in the UK better for industry?',
      'Can we empower industry to discover UK cohorts/sites?',
      'Can we create innovative partnerships to improve MH diagnosis and treatment?',
    ],
    differentiators: [
      'We focus on discovery and planning more than delivery where we expect to link-up with sites, cohorts, MHM, TRCs, RDNs',
      'We focus on tools developed with industry in mind to support entry into the UK',
      'We work across the entirety of MH, including psychiatric symptoms in neurodegenerative disorders',
    ],
  },
  'innovative-trials-hub': {
    boundaryStatement:
      'Strengthening mental health trial design and methodology in partnership with industry\n\nMakes trials better',
    primaryFocus: ['Providing trial design and methodology support to industry'],
    keyQuestions: ['How do we improve the design and success of MHG clinical trials?'],
    differentiators: [
      'Focuses specifically on trial design and methodology, not on navigation or data access',
    ],
  },
  'lived-experience-industry-partnership': {
    boundaryStatement:
      'Integrating lived experience as a key voice in mental health R & D\n\nEnsures patients are being heard',
    primaryFocus: [
      'Fosters partnerships between patients with lived experience, researchers, and industry — so treatments actually reflect what matters most to people',
    ],
    keyQuestions: [
      'How do we align what patients care about with what researchers study and what industry develops?',
      'Are there tools we can build or teams we can collaborate for this purpose?',
    ],
    differentiators: ['Specialist workstream for lived experience'],
  },
  'digital-innovation': {
    boundaryStatement:
      'Building the infrastructure, standards and partnerships needed to enable safe, equitable, scalable adoption of digital mental health innovation across the NHS and beyond. Ensuring digital innovation is driven by the priorities, experiences and outcomes that matter to patients, carers and clinicians.',
    primaryFocus: [
      'Developing sustainable infrastructure and services that support digital mental health innovation, adoption and scale-up in the NHS',
      'Aligning digital innovation with lived experience, NHS needs and industry priorities.',
      'Supporting NHS implementation, adoption and scaling of digital mental health innovations.',
      'Developing sustainable investment models, strategic partnerships and technology horizon scanning.',
    ],
    keyQuestions: [
      'How do we create a clear, scalable route for digital mental health technologies into NHS practice?',
      'How do we ensure digital technologies solve problems that matter to patients, carers, clinicians and industry?',
      'How do we move beyond pilot projects and achieve sustainable multi-site NHS adoption?',
      'How do we improve investment readiness, attract partners and identify technologies that meet NHS demand?',
    ],
    differentiators: [
      'Cross-sector infrastructure spanning industry, NHS, investors, regulators, lived experience groups and international partners.',
      'Combines lived experience, industry, regulatory and commissioning perspectives to shape standards and adoption pathways.',
      'Focuses on NHS operational adoption, workforce readiness and implementation support rather than product development.',
      'Unique focus on public-private investment, international partnerships and systematic technology evaluation.',
    ],
  },
  'data-observatory': {
    boundaryStatement:
      'The DATAMIND Observatory is MHG’s real world analytics service. We generate evidence, not data assets; we support trial decisions, not trial delivery.',
    primaryFocus: [
      'Using existing mental health data to generate real-world evidence that supports the whole trial lifecycle (from planning and optimisation, through to post-trial decision-making).',
      'Providing a service to industry which is bespoke to the UK mental health domain.',
    ],
    keyQuestions: [
      'How can real world data reduce uncertainty in planning a trial, before it begins? (e.g., feasibility, or refining protocols).',
      'How can we reduce evidence gaps in mental health treatment development and approval?',
      'How can analytics be purpose-built for UK mental health research rather than generic to other disease areas?',
      'How do we provide the insights that industry needs without requiring them to access or manage sensitive health data themselves?',
    ],
    differentiators: [
      'We don’t collect, manage, or store patient-level data. We access research-ready datasets via existing trusted infrastructure, and will only generate derived measures or variables as required for analysis, without creating new patient-level data assets.',
      'We don’t facilitate industry access to individual-level data, we only provide disclosure controlled analytics.',
      'We only use real-world de-identified datasets, meaning any projects requiring identified patient data (e.g., for active recruitment, or trial operations) would be via collaboration only.',
      'We can’t change whether a treatment works, but we can improve the odds that the right evidence is generated to evaluate it robustly.',
    ],
  },
  'multi-omics': {
    boundaryStatement:
      'Transforming mental health research from symptom-based approaches towards biologically informed discovery, stratification and treatment development, in partnership with people with lived experience, the NHS and industry.',
    primaryFocus: [
      'Building the world’s largest nationally representative mental health multi-omics dataset across psychosis and severe depression, linked to clinical phenotypes and health record data, while creating sustainable NHS biosampling infrastructure.',
    ],
    keyQuestions: [
      'How do we establish a nationally representative, trial-ready UK multi-omics cohort in severe mental illness?',
      'How do we build sustainable NHS capacity for biological sample collection, processing and workforce development?',
      'How do we create a trial-ready, industry-standard platform that enables precision psychiatry, AI-driven research and stratified clinical trials?',
      'How do we embed meaningful partnerships with people with lived experience and industry throughout the design and delivery of mental health research?',
    ],
    differentiators: [
      'MHG Omics creates new biological research resources through the collection and analysis of genomic, epigenomic, proteomic and metabolomic data. It also builds NHS biosampling infrastructure and develops multi-omics cohorts designed to support biomarker discovery, precision psychiatry, AI-driven research and future stratified trials.',
    ],
  },
}
