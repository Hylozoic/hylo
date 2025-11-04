import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { isEmpty } from 'lodash'
import { buttonVariants, type ButtonProps } from './button-variants'
import { Tooltip, TooltipTrigger } from './tooltip'
import { cn } from 'util/index'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, tooltip, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    const buttonElement = (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )

    if (!isEmpty(tooltip)) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            {buttonElement}
          </TooltipTrigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              sideOffset={4}
              className='z-[1000] overflow-hidden rounded-md bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'
            >
              {tooltip}
              <TooltipPrimitive.Arrow className='fill-popover' />
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </Tooltip>
      )
    }

    return buttonElement
  }
)
Button.displayName = 'Button'

export default Button
