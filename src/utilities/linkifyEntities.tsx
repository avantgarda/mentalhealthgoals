import React, { Fragment } from 'react'

/**
 * Named entities that should link to their own site wherever they are
 * mentioned in plain-text CMS fields (workstream summaries and descriptions).
 * Longest phrases first so "GLAD (Genetic Links…) Study" wins over "GLAD".
 */
const ENTITIES: { phrase: string; url: string }[] = [
  {
    phrase: 'GLAD (Genetic Links to Anxiety and Depression) Study',
    url: 'https://gladstudy.org.uk/',
  },
  { phrase: 'GLAD Study', url: 'https://gladstudy.org.uk/' },
  { phrase: 'DATAMIND', url: 'https://datamind.org.uk/' },
  { phrase: 'Mental Health Digital Innovation', url: 'https://www.mhdi.uk' },
  {
    phrase: 'Centre for Neuropsychiatric Genetics and Genomics',
    url: 'https://www.cardiff.ac.uk/centre-neuropsychiatric-genetics-genomics',
  },
  {
    phrase: 'NIHR Innovation Service',
    url: 'https://www.nihr.ac.uk',
  },
  {
    phrase: 'MRC Mental Health Platform',
    url: 'https://www.ukri.org/councils/mrc/',
  },
]

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const PATTERN = new RegExp(
  `(${ENTITIES.map((entity) => escapeRegExp(entity.phrase)).join('|')})`,
  'g',
)

/**
 * Renders plain text with known organisations turned into external links.
 * Only the FIRST occurrence of each entity in a given string is linked, so a
 * paragraph never repeats the same link.
 */
export const LinkifyEntities: React.FC<{ text?: string | null }> = ({ text }) => {
  if (!text) return null

  const parts = text.split(PATTERN)
  const linked = new Set<string>()

  return (
    <>
      {parts.map((part, i) => {
        const entity = ENTITIES.find((candidate) => candidate.phrase === part)

        if (!entity || linked.has(entity.phrase)) return <Fragment key={i}>{part}</Fragment>

        linked.add(entity.phrase)

        return (
          <a
            className="link-line"
            href={entity.url}
            key={i}
            rel="noopener noreferrer"
            target="_blank"
          >
            {part}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )
      })}
    </>
  )
}
