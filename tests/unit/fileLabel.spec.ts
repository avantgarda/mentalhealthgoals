import { describe, expect, it } from 'vitest'

import { fileLabel, fileType, formatFileSize } from '@/utilities/fileLabel'

describe('formatFileSize', () => {
  it('matches the sizes already typed beside the Forum slides', () => {
    // Byte counts of the ten launch-meeting PDFs, and what the page said.
    const typed: [number, string][] = [
      [3_268_338, '3.3 MB'],
      [516_069, '516 KB'],
      [2_340_806, '2.3 MB'],
      [339_771, '340 KB'],
      [864_291, '864 KB'],
      [1_395_368, '1.4 MB'],
      [2_376_962, '2.4 MB'],
      [1_931_236, '1.9 MB'],
      [2_486_628, '2.5 MB'],
      [2_281_521, '2.3 MB'],
    ]
    for (const [bytes, label] of typed) expect(formatFileSize(bytes)).toBe(label)
  })

  it('moves to MB at the point KB would read 1000', () => {
    expect(formatFileSize(999_499)).toBe('999 KB')
    expect(formatFileSize(999_600)).toBe('1.0 MB')
    expect(formatFileSize(1_000_000)).toBe('1.0 MB')
  })

  it('never says a file weighs nothing', () => {
    expect(formatFileSize(312)).toBe('1 KB')
  })
})

describe('fileType', () => {
  it('names a PDF by its type, whatever the filename says', () => {
    expect(fileType({ mimeType: 'application/pdf', filename: 'slides' })).toBe('PDF')
  })

  it('falls back to the extension, in capitals', () => {
    expect(fileType({ mimeType: 'image/png', filename: 'chart.png' })).toBe('PNG')
    expect(fileType({ mimeType: null, filename: 'notes.Docx' })).toBe('DOCX')
  })

  it('says nothing it cannot tell', () => {
    expect(fileType({ mimeType: 'application/octet-stream', filename: 'README' })).toBeNull()
    expect(fileType({})).toBeNull()
  })
})

describe('fileLabel', () => {
  it('gives the type and size together', () => {
    expect(fileLabel({ mimeType: 'application/pdf', filename: 'a.pdf', filesize: 2_340_806 })).toBe(
      'PDF, 2.3 MB',
    )
  })

  it('gives what it has when one half is missing', () => {
    expect(fileLabel({ mimeType: 'application/pdf', filename: 'a.pdf', filesize: null })).toBe(
      'PDF',
    )
    expect(fileLabel({ mimeType: null, filename: 'README', filesize: 516_069 })).toBe('516 KB')
    expect(fileLabel({})).toBe('')
  })
})
