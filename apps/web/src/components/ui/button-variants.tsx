import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover:scale-101 hover:opacity-100 disabled:opacity-50 disabled:hover:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary/90 scale-100 hover:scale-101 hover:opacity-100 flex items-center justify-between border-2 border-transparent hover:border-foreground/20 hover:shadow-xl',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        highVisibility:
          'p-2 rounded-md bg-selected text-foreground text-xs sm:text-base hover:bg-selected/90 border-2 border-transparent hover:border-foreground/20 transition-all scale-100 hover:scale-105 hover:opacity-100 flex items-center hover:shadow-xl',
        outline:
          'focus:text-foreground text-base border-2 border-foreground/20 hover:border-foreground/50 hover:text-foreground rounded-md p-2 bg-background text-foreground transition-all scale-100 hover:scale-101 hover:opacity-100 flex items-center justify-between group opacity-100',
        selectedOutline:
          'focus:text-foreground text-base border-2 border-selected/100 hover:border-foreground/50 hover:text-foreground rounded-md p-2 bg-background text-foreground transition-all scale-100 hover:scale-105 hover:opacity-100 flex items-center justify-between group opacity-100',
        secondary:
          'bg-secondary/80 text-secondary-foreground hover:bg-secondary hover:opacity-100 disabled:hover:bg-secondary/80',
        tertiary:
          'bg-tertiary text-tertiary-foreground hover:bg-tertiary/80',
        ghost: 'hover:bg-selected hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  tooltip?: React.ReactNode
}
