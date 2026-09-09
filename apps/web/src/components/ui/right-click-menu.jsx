import * as React from 'react'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Returns true when the event landed on an open Radix menu panel.
 */
function isEventOnMenu (target) {
  if (!(target instanceof globalThis.Node)) return false
  return Array.from(document.querySelectorAll('[data-radix-menu-content]')).some(
    (node) => node.contains(target)
  )
}

/**
 * Non-modal so the page stays scrollable and a press outside can close the
 * menu. Modal mode sets body pointer-events: none, which on iOS swallows
 * that outside press. Radix also waits for `click` on touch, so a press
 * that turns into a scroll never dismisses — remounting on pointerdown
 * or scroll closes it immediately.
 */
function RightClickMenu ({ modal = false, onOpenChange, ...props }) {
  const [open, setOpen] = React.useState(false)
  const [instance, setInstance] = React.useState(0)
  const onOpenChangeRef = React.useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  const handleOpenChange = (next) => {
    setOpen(next)
    onOpenChangeRef.current?.(next)
  }

  React.useEffect(() => {
    if (!open) return

    const dismiss = (event) => {
      if (isEventOnMenu(event.target)) return
      setOpen(false)
      setInstance((n) => n + 1)
      onOpenChangeRef.current?.(false)
    }

    const timeoutId = window.setTimeout(() => {
      document.addEventListener('pointerdown', dismiss, true)
      window.addEventListener('scroll', dismiss, true)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
      document.removeEventListener('pointerdown', dismiss, true)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [open])

  return (
    <ContextMenuPrimitive.Root
      key={instance}
      modal={modal}
      onOpenChange={handleOpenChange}
      {...props}
    />
  )
}

const RightClickMenuTrigger = ContextMenuPrimitive.Trigger

const RightClickMenuGroup = ContextMenuPrimitive.Group

const RightClickMenuPortal = ContextMenuPrimitive.Portal

const RightClickMenuSub = ContextMenuPrimitive.Sub

const RightClickMenuRadioGroup = ContextMenuPrimitive.RadioGroup

const RightClickMenuSubTrigger = React.forwardRef(({ className, inset, children, ...props }, ref) => (
  <ContextMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
      inset && 'pl-8',
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className='ml-auto h-4 w-4' />
  </ContextMenuPrimitive.SubTrigger>
))
RightClickMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName

const RightClickMenuSubContent = React.forwardRef(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      'z-[500] min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-context-menu-content-transform-origin]',
      className
    )}
    {...props}
  />
))
RightClickMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName

const RightClickMenuContent = React.forwardRef(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      className={cn(
        'z-[500] max-h-[--radix-context-menu-content-available-height] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-context-menu-content-transform-origin]',
        className
      )}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
))
RightClickMenuContent.displayName = ContextMenuPrimitive.Content.displayName

const RightClickMenuItem = React.forwardRef(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
))
RightClickMenuItem.displayName = ContextMenuPrimitive.Item.displayName

const RightClickMenuCheckboxItem = React.forwardRef(({ className, children, checked, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    checked={checked}
    {...props}
  >
    <span className='absolute left-2 flex h-3.5 w-3.5 items-center justify-center'>
      <ContextMenuPrimitive.ItemIndicator>
        <Check className='h-4 w-4' />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.CheckboxItem>
))
RightClickMenuCheckboxItem.displayName =
  ContextMenuPrimitive.CheckboxItem.displayName

const RightClickMenuRadioItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className='absolute left-2 flex h-3.5 w-3.5 items-center justify-center'>
      <ContextMenuPrimitive.ItemIndicator>
        <Circle className='h-2 w-2 fill-current' />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.RadioItem>
))
RightClickMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName

const RightClickMenuLabel = React.forwardRef(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Label
    ref={ref}
    className={cn(
      'px-2 py-1.5 text-sm font-semibold text-foreground',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
))
RightClickMenuLabel.displayName = ContextMenuPrimitive.Label.displayName

const RightClickMenuSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-border', className)}
    {...props}
  />
))
RightClickMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName

const RightClickMenuShortcut = ({
  className,
  ...props
}) => {
  return (
    (
      <span
        className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)}
        {...props}
      />
    )
  )
}
RightClickMenuShortcut.displayName = 'ContextMenuShortcut'

export {
  RightClickMenu,
  RightClickMenuTrigger,
  RightClickMenuContent,
  RightClickMenuItem,
  RightClickMenuCheckboxItem,
  RightClickMenuRadioItem,
  RightClickMenuLabel,
  RightClickMenuSeparator,
  RightClickMenuShortcut,
  RightClickMenuGroup,
  RightClickMenuPortal,
  RightClickMenuSub,
  RightClickMenuSubContent,
  RightClickMenuSubTrigger,
  RightClickMenuRadioGroup
}
