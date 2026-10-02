import type { PayloadRequest } from 'payload'

import { revalidatePath } from 'next/cache'

/**
 * A page that shows an image carries the file's URL in its cached HTML. When
 * an image is replaced, the old file is deleted from storage, yet every page
 * showing it goes on pointing at the old URL until something else rebuilds
 * it. Rebuild them all, as the People and Workstreams hooks do for theirs.
 */
export const revalidateMedia = ({ req: { context } }: { req: PayloadRequest }): void => {
  if (!context.disableRevalidate) revalidatePath('/', 'layout')
}
