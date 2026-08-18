'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'

import { BrandMark } from '@/components/Logo/BrandMark'
import { BRAND_COLORS } from '@/brand/tokens'
import { LOGO_VARIANTS, MARKS, resolveLogoVariant } from '@/brand/marks'

/**
 * Admin-only preview: shows every mark side by side with the selected one
 * highlighted, on light and dark grounds and at favicon scale, so an editor can
 * see what they are choosing without leaving the field.
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
                minWidth: 190,
                opacity: isSelected ? 1 : 0.55,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                <div style={{ color: BRAND_COLORS.petrol, lineHeight: 0 }}>
                  <BrandMark size={40} variant={variant} title={MARKS[variant].label} />
                </div>
                <div
                  style={{
                    background: BRAND_COLORS.deep,
                    color: BRAND_COLORS.reversed,
                    borderRadius: 8,
                    padding: '0.35rem',
                    lineHeight: 0,
                  }}
                >
                  <BrandMark size={32} variant={variant} />
                </div>
                <div style={{ color: BRAND_COLORS.petrol, lineHeight: 0 }}>
                  <BrandMark size={16} variant={variant} />
                </div>
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
