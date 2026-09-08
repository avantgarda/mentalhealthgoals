'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'

import { BrandMark } from '@/components/Logo/BrandMark'
import { BRAND_COLORS } from '@/brand/tokens'
import { LOGO_VARIANTS, MARKS, markWidth, resolveLogoVariant } from '@/brand/marks'

const Sample: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
    <div style={{ height: 40, display: 'flex', alignItems: 'center' }}>{children}</div>
    <span
      style={{
        fontSize: '0.62rem',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        opacity: 0.55,
      }}
    >
      {label}
    </span>
  </div>
)

/**
 * Admin-only preview: shows every mark side by side with the selected one
 * highlighted, at each size tier it is used at — header, app icon, favicon and
 * 16 px — so an editor can see what they are choosing without leaving the
 * field. Marks that are wide or detailed draw a simplified glyph at favicon
 * sizes; the labels make that tiering visible rather than surprising.
 */
export const LogoPreview: React.FC = () => {
  const value = useFormFields(([fields]) => fields?.logoVariant?.value)
  const selected = resolveLogoVariant(value)

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div
        style={{
          fontSize: '0.8rem',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          opacity: 0.6,
          marginBottom: '0.75rem',
        }}
      >
        Preview
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        {LOGO_VARIANTS.map((variant) => {
          const isSelected = variant === selected

          return (
            <div
              key={variant}
              style={{
                border: `2px solid ${isSelected ? BRAND_COLORS.amber : 'rgba(128,128,128,0.25)'}`,
                borderRadius: 6,
                padding: '0.9rem 1rem',
                background: BRAND_COLORS.paper,
                minWidth: 250,
                opacity: isSelected ? 1 : 0.55,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.1rem' }}>
                <Sample label="Header">
                  <div style={{ color: BRAND_COLORS.petrol, lineHeight: 0 }}>
                    <BrandMark size={40} variant={variant} title={MARKS[variant].label} />
                  </div>
                </Sample>
                <Sample label="App icon">
                  <div
                    style={{
                      background: BRAND_COLORS.deep,
                      color: BRAND_COLORS.reversed,
                      borderRadius: 8,
                      width: 40,
                      height: 40,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 0,
                    }}
                  >
                    <BrandMark
                      size={Math.round(40 / Math.max(1, markWidth(variant) / 96))}
                      variant={variant}
                    />
                  </div>
                </Sample>
                <Sample label="Favicon">
                  <div
                    style={{
                      background: BRAND_COLORS.deep,
                      color: BRAND_COLORS.reversed,
                      borderRadius: 6,
                      padding: '0.25rem',
                      lineHeight: 0,
                    }}
                  >
                    <BrandMark compact size={24} variant={variant} />
                  </div>
                </Sample>
                <Sample label="16 px">
                  <div style={{ color: BRAND_COLORS.petrol, lineHeight: 0, paddingTop: 8 }}>
                    <BrandMark compact size={16} variant={variant} />
                  </div>
                </Sample>
              </div>

              <div
                style={{
                  marginTop: '0.6rem',
                  fontSize: '0.72rem',
                  lineHeight: 1.35,
                  color: BRAND_COLORS.ink,
                }}
              >
                <strong style={{ display: 'block' }}>
                  {isSelected ? 'In use — ' : ''}
                  {MARKS[variant].label}
                </strong>
                <span style={{ opacity: 0.75 }}>{MARKS[variant].description}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
