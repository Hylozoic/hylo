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

  const handleBackdropClick = useCallback(() => {
    handleOpenChange(false)
  }, [handleOpenChange])

  const handleInteractOutside = useCallback((e) => {
    // Don't dismiss while the user is selecting text (iOS handle drags can register as outside).
    if (
      shouldBailTextSelectionGesture(e.target) ||
      hasActiveTextSelection() ||
      isSelectionInPostDetail()
    ) {
      e.preventDefault()
      return
    }

    const target = e.target
    const className = target?.className
    if (typeof className === 'string' && className.includes('fsp')) {
      e.preventDefault()
      return
    }
    if (target?.children?.[0]?.className?.includes?.('fsp')) {
      e.preventDefault()
      return
    }

    const overlay = document.querySelector('.PostDialog-Overlay')
    if (overlay && !overlay.contains(target)) {
      if (!target.contains(overlay)) {
        e.preventDefault()
      }
    }
  }, [])

  return (
    <Dialog.Root open={dialogOpen} onOpenChange={handleOpenChange} modal={false}>
      <Dialog.Portal container={portalContainer}>
        {/*
          modal={false} avoids Radix setting body { pointer-events: none }, which breaks
          iOS text selection in WKWebView (handles render outside the dismissable layer).
          Dialog.Overlay is not rendered when modal={false}, so use a plain backdrop div.
        */}
        <div
          role='presentation'
          className='PostDialog-Overlay bg-darkening/50 dark:bg-darkening/90 absolute inset-0 z-[100] backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-200'
          onClick={handleBackdropClick}
        />
        <Dialog.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
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
