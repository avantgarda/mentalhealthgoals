/** @type {import('tailwindcss').Config} */
const config = {
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: [
            {
              '--tw-prose-body': 'var(--foreground)',
              '--tw-prose-headings': 'var(--foreground)',
              maxWidth: '66ch',
              h1: {
                fontWeight: 'normal',
                marginBottom: '0.25em',
              },
              'p, li': {
                textWrap: 'pretty',
              },
            },
          ],
        },
        base: {
          css: [
            {
              fontSize: '1.0625rem',
              lineHeight: '1.6',
              h1: {
                fontSize: '2.5rem',
              },
              h2: {
                fontSize: '1.65rem',
                fontWeight: 400,
              },
            },
          ],
        },
        md: {
          css: [
            {
              fontSize: '1.0625rem',
              lineHeight: '1.65',
              h1: {
                fontSize: '3.25rem',
              },
              h2: {
                fontSize: '2rem',
              },
            },
          ],
        },
      },
    },
  },
}

export default config
