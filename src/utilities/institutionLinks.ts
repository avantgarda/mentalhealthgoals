/**
 * Canonical websites for the programme's delivery institutions, keyed by the
 * exact names used in the Workstreams `deliveredBy` field. Rendering splits
 * that field on '·' and links any part that appears here.
 */
export const INSTITUTION_URLS: Record<string, string> = {
  'King’s College London': 'https://www.kcl.ac.uk',
  'Cardiff University': 'https://www.cardiff.ac.uk',
  'Queen’s University Belfast': 'https://www.qub.ac.uk',
  'University of Edinburgh': 'https://www.ed.ac.uk',
  'University of Cambridge': 'https://www.cam.ac.uk',
  'University of Oxford': 'https://www.ox.ac.uk',
  'University of Manchester': 'https://www.manchester.ac.uk',
  'Swansea University': 'https://www.swansea.ac.uk',
  'University of Liverpool': 'https://www.liverpool.ac.uk',
  'Health Innovation Oxford & Thames Valley': 'https://www.healthinnovationoxford.org',
}

export const splitInstitutions = (deliveredBy: string): string[] =>
  deliveredBy
    .split('·')
    .map((part) => part.trim())
    .filter(Boolean)
