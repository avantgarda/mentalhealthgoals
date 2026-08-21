'use client'

import { cn } from '@/utilities/ui'
import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import * as React from 'react'

/**
 * Rectangular, quiet, with every state designed: hover shifts tone, active
 * presses by a pixel, focus gets the global ring, disabled fades.
 */
const buttonVariants = cva(
  "group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[2px] text-sm font-medium tracking-[0.01em] transition-[color,background-color,border-color,transform] duration-[var(--dur-ui)] ease-[var(--ease-out)] active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-current aria-invalid:focus-visible:outline-destructive",
  {
    variants: {
      variant: {
        default: 'bg-foreground text-background hover:bg-primary hover:text-primary-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-current/40 bg-transparent text-foreground hover:border-current hover:bg-foreground/[0.04]',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-foreground/[0.05]',
        link: 'link-line text-current',
      },
      size: {
        clear: '',
        default: 'h-11 px-5',
        sm: 'h-9 px-3.5 text-[0.8125rem]',
        lg: 'h-12 px-6 text-[0.9375rem]',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button: React.FC<ButtonProps> = ({ asChild = false, className, size, variant, ...props }) => {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
