import type { Media } from '@/payload-types'

/**
 * A file size as readers see it beside a download link: "516 KB", "2.3 MB".
 * Decimal units, as macOS Finder and most browsers show them, so the figure
 * matches what someone sees once the file lands.
 */
export function formatFileSize(bytes: number): string {
  const kilobytes = Math.round(bytes / 1e3)
  // 999,600 bytes is "1.0 MB", not "1000 KB".
  if (kilobytes >= 1000) return `${(bytes / 1e6).toFixed(1)} MB`
  return `${Math.max(kilobytes, 1)} KB`
}

/** "PDF" for a PDF, otherwise the filename's extension in capitals. */
export function fileType({
  filename,
  mimeType,
}: Pick<Media, 'filename' | 'mimeType'>): string | null {
  if (mimeType === 'application/pdf') return 'PDF'
  const extension = filename?.match(/\.([a-z0-9]+)$/i)?.[1]
  return extension ? extension.toUpperCase() : null
}

/**
 * What a link to an uploaded file tells the reader before they click:
 * "PDF, 2.3 MB". Empty when neither the type nor the size is known.
 */
export function fileLabel(file: Pick<Media, 'filename' | 'filesize' | 'mimeType'>): string {
  const size = typeof file.filesize === 'number' ? formatFileSize(file.filesize) : null
  return [fileType(file), size].filter(Boolean).join(', ')
}
