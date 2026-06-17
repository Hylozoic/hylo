import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'

import { removePostFromUrl } from '@hylo/navigation'
import {
  hasActiveTextSelection,
  isSelectionInPostDetail,
  shouldBailTextSelectionGesture
} from 'util/textSelectionTouch'

import PostDetail from 'routes/PostDetail/PostDetail'

const PostDialog = ({
  container
}) => {
  const navigate = useNavigate()
  const location = useLocation()

  const postDetailRef = useRef(null)
  const [dialogOpen, setDialogOpen] = useState(true)

  const portalContainer = useMemo(() => container || document.getElementById('center-column-container'), [container])

  const dismiss = useCallback(() => {
    navigate({
      pathname: removePostFromUrl(location.pathname) || '/',
      search: location.search
    })
  }, [navigate, location.pathname, location.search])

  const handleOpenChange = useCallback((open) => {
    if (open) {
      setDialogOpen(true)
      return
    }
    const blocked = postDetailRef.current?.blockEmbeddedDismiss?.()
    if (blocked) {
      setDialogOpen(true)
      return
    }
    setDialogOpen(false)
    dismiss()
  }, [dismiss])

  const handleInteractOutside = useCallback((e) => {
    // Radix dismiss + RemoveScroll can steal iOS text-selection handle drags.
    if (
      shouldBailTextSelectionGesture(e.target) ||
      hasActiveTextSelection() ||
      isSelectionInPostDetail()
    ) {
      e.preventDefault()
      return
    }

    if (e.target.className.includes('fsp') || e.target.children[0].className.includes('fsp')) {
      // Don't close the dialog if the user is interacting with the filestack picker
      e.preventDefault()
      return false
    }

    // Don't close the dialog if the user is interacting with elements that are not parents of the overlay
    const overlay = document.querySelector('.PostDialog-Overlay')
    if (overlay && !overlay.contains(e.target)) {
      // Check if the target element contains the overlay (is a parent/ancestor)
      if (!e.target.contains(overlay)) {
        e.preventDefault()
        return false
      }
    }
  }, [])

  return (
    <Dialog.Root open={dialogOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal container={portalContainer}>
        {/*
          Overlay is backdrop-only (sibling of Content). Previously Content was nested
          inside the scrollable Overlay, so pull-to-close and overflow clipped iOS
          selection handles on comments and the composer.
        */}
        <Dialog.Overlay
          className='PostDialog-Overlay bg-darkening/50 dark:bg-darkening/90 absolute inset-0 z-[100] backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-200'
        />
        <Dialog.Content
          onInteractOutside={handleInteractOutside}
          onPointerDownOutside={handleInteractOutside}
          className='PostDialog-Content absolute left-1/2 top-1/2 z-[101] min-w-[300px] w-[calc(100%-16px)] max-w-[750px] max-h-[calc(100%-16px)] overflow-y-auto overflow-x-visible bg-background p-3 rounded-md outline-none -translate-x-1/2 -translate-y-1/2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-4 duration-300'
          id='post-dialog-content'
        >
          <Dialog.Title className='sr-only'>Post Dialog</Dialog.Title>
          <Dialog.Description className='sr-only'>Post Dialog</Dialog.Description>
          <PostDetail ref={postDetailRef} inPostDialog onDismissEmbeddedDialog={dismiss} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default PostDialog
