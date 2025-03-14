import React from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogPortal,
  DialogOverlay
} from 'components/ui/dialog'

const GlobalAlert = ({
  children,
  closeButton,
  description,
  onOpenChange,
  title
}) => {
  return (
    <Dialog
      defaultOpen
      onOpenChange={onOpenChange}
    >
      <DialogPortal>
        <DialogOverlay className='GlobalAlert-Overlay'>
          <DialogContent className='GlobalAlert-Content'>
            <DialogTitle className=''>{title}</DialogTitle>
            {children}
            {closeButton && (
              <DialogClose asChild>
                {closeButton}
              </DialogClose>
            )}
          </DialogContent>
        </DialogOverlay>
      </DialogPortal>
    </Dialog>
  )
}

export default GlobalAlert
