import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogPortal,
  DialogOverlay
} from 'components/ui/dialog'

const GlobalAlert = ({
  children,
  title,
  description,
  onOpenChange
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
          </DialogContent>
        </DialogOverlay>
      </DialogPortal>
    </Dialog>
  )
}

export default GlobalAlert
