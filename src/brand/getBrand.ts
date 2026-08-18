import { getCachedGlobal } from '@/utilities/getGlobals'
import { DEFAULT_LOGO_VARIANT, resolveLogoVariant, type LogoVariant } from './marks'

export interface BrandSettings {
  variant: LogoVariant
  showTagline: boolean
}

const FALLBACK: BrandSettings = {
  variant: DEFAULT_LOGO_VARIANT,
  showTagline: true,
}

/**
 * Reads the Brand global. Falls back to the default mark if the global has not
 * been created yet — e.g. on a database where the migration has not run — so a
 * missing row can never take the site down.
 */
export const getBrandSettings = async (): Promise<BrandSettings> => {
  try {
    const brand = await getCachedGlobal('brand', 0)()

    return {
      variant: resolveLogoVariant(brand?.logoVariant),
      showTagline: brand?.showTagline !== false,
    }
  } catch {
    return FALLBACK
  }
}

/** Public path to the generated asset directory for a variant. */
export const brandAssetPath = (variant: LogoVariant, file: string): string =>
  `/brand/${variant}/${file}`
