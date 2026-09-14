import type { CheckboxField } from '@payloadcms/plugin-form-builder/types'
import type { FieldErrorsImpl } from 'react-hook-form'

import { Controller, useFormContext } from 'react-hook-form'

import { Checkbox as CheckboxUi } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import React from 'react'

import { Error } from '../Error'
import { Width } from '../Width'

/**
 * A controlled box, so the form's value is the box's own state and nothing
 * else. The template spread `register` onto the Radix root — a <button> whose
 * `value` attribute is "on" — and react-hook-form read that attribute the
 * moment it mounted: an untouched box submitted as "on", and satisfied
 * `required` while doing so. Consent nobody had given was recorded as given.
 */
export const Checkbox: React.FC<
  CheckboxField & {
    errors: Partial<FieldErrorsImpl>
  }
> = ({ name, defaultValue, errors, label, required, width }) => {
  const { control } = useFormContext()

  return (
    <Width width={width}>
      <Controller
        control={control}
        defaultValue={defaultValue === true}
        name={name}
        rules={{ required: required === true }}
        render={({ field: { onChange, ref, value } }) => (
          <div className="flex items-center gap-2">
            <CheckboxUi
              checked={value === true}
              id={name}
              onCheckedChange={(checked) => onChange(checked === true)}
              ref={ref}
            />
            <Label htmlFor={name}>
              {required && (
                <span className="required">
                  * <span className="sr-only">(required)</span>
                </span>
              )}
              {label}
            </Label>
          </div>
        )}
      />
      {errors[name] && <Error name={name} />}
    </Width>
  )
}
