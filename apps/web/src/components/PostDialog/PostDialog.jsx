import React, { useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'

import { removePostFromUrl } from '@hylo/navigation'

import PostDetail from 'routes/PostDetail/PostDetail'

const PostDialog = ({
  container
}) => {
  const navigate = useNavigate()
  const location = useLocation()

  const handleOpenChange = useCallback((open) => {
    if (!open) {
      // remove post/:postId from the url
      navigate(removePostFromUrl(`${location.pathname}${location.search}`))
    }
  }, [navigate, location])

  const handleInteractOutside = useCallback((e) => {
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
    <Dialog.Root defaultOpen onOpenChange={handleOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay
          className='PostDialog-Overlay bg-darkening/50 absolute left-0 right-0 bottom-0 grid place-items-center overflow-y-auto z-[100] h-full backdrop-blur-sm p-2'
        >
          <Dialog.Content
            onInteractOutside={handleInteractOutside}
            className='PostDialog-Content min-w-[300px] w-full bg-background p-3 rounded-md z-[41] max-w-[750px] outline-none relative'
            id='post-dialog-content'
          >
            <Dialog.Title className='sr-only'>Post Dialog</Dialog.Title>
            <Dialog.Description className='sr-only'>Post Dialog</Dialog.Description>
            <PostDetail />
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default PostDialog
