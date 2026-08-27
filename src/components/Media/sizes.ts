/**
 * `sizes` descriptors for the image slots this site actually has.
 *
 * `sizes` tells the browser how wide an image will be *rendered*, so it can
 * pick the right entry from the srcset. Get it wrong and the browser assumes
 * `100vw` and downloads a full-viewport render for a thumbnail.
 *
 * The numbers below follow the `.container` rules in `globals.css`, which are
 * `max-width: var(--breakpoint-*)` with a padding-inline that steps up:
 *
 * | viewport      | container max | padding | inner width |
 * | ------------- | ------------- | ------- | ----------- |
 * | < 640         | —             | 20px    | 100vw − 40  |
 * | 640 – 767     | 640           | 20px    | 600         |
 * | 768 – 1023    | 768           | 32px    | 704         |
 * | 1024 – 1279   | 1024          | 32px    | 960         |
 * | 1280 – 1375   | 1280          | 40px    | 1200        |
 * | ≥ 1376        | 1440          | 40px    | 1360        |
 *
 * Each descriptor rounds *up* — over-fetching slightly is safe, under-fetching
 * shows as a soft image on a high-density screen.
 */

/** Edge-to-edge: heroes that bleed past the container. */
export const SIZE_FULL_BLEED = '100vw'

/** One container column: media blocks, the medium-impact hero figure. */
export const SIZE_CONTAINER = '(max-width: 767px) 100vw, (max-width: 1375px) 94vw, 1360px'

/** The team grid: 2 columns, then 3 from `md`, then 4 from `lg`. */
export const SIZE_PERSON_CARD =
  '(max-width: 639px) 46vw, (max-width: 767px) 288px, (max-width: 1023px) 220px, 320px'
