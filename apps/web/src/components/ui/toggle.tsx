'use client'

import * as React from 'react'
import * as TogglePrimitive from '@radix-ui/react-toggle'
import toggleVariants from 'components/ui/toggle-variants'
import { type VariantProps } from 'class-variance-authority'

import { cn } from 'util/index'

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
))

Toggle.displayName = TogglePrimitive.Root.displayName

export default Toggle
