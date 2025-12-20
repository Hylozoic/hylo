import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'

import { cn } from '@/lib/utils'

const Switch = React.forwardRef(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer relative inline-flex h-6 w-12 shrink-0 cursor-pointer items-center justify-between rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-selected data-[state=unchecked]:bg-foreground/50',
      className
    )}
    {...props}
    ref={ref}
  >
    <span className='text-[8px] font-bold uppercase text-white pl-1.5 opacity-0 data-[state=checked]:opacity-100 transition-opacity duration-200' data-state={props.checked ? 'checked' : 'unchecked'}>
      ON
    </span>
    <span className='text-[8px] font-bold uppercase text-white pr-1 opacity-0 data-[state=unchecked]:opacity-100 transition-opacity duration-200' data-state={props.checked ? 'checked' : 'unchecked'}>
      OFF
    </span>
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none absolute top-[2px] block h-4 w-4 rounded-full bg-white shadow-md ring-0 transition-all duration-200 data-[state=checked]:left-[26px] data-[state=unchecked]:left-0.5'
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
