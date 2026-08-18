import type { GlobalAfterChangeHook } from 'payload'

import { revalidateTag } from 'next/cache'

export const revalidateBrand: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Revalidating brand`)

    // The logo appears in the header, the footer and the document head, so the
    // whole shell needs rebuilding when the mark changes.
    revalidateTag('global_brand', 'max')
    revalidateTag('global_header', 'max')
    revalidateTag('global_footer', 'max')
  }

  return doc
}
