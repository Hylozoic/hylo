import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import * as Dialog from '@radix-ui/react-dialog'

import { removePostFromUrl } from '@hylo/navigation'
import useRouteParams from 'hooks/useRouteParams'
import getMe from 'store/selectors/getMe'
import getPost from 'store/selectors/getPost'
import presentPost from 'store/presenters/presentPost'
import { getPostDetailCloseDestination, shouldUseSmartPostClose } from 'util/postDetailCloseNavigation'

import PostDetail from 'routes/PostDetail/PostDetail'

const PostDialog = ({
  container
}) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { postId, groupSlug, view } = useRouteParams()
  const currentUser = useSelector(getMe)
  const postSelector = useSelector(state => getPost(state, postId))
  const post = useMemo(() => {
    if (!postSelector) return null
    return presentPost(postSelector) || postSelector.ref || null
  }, [postSelector])

  const postDetailRef = useRef(null)
  const [dialogOpen, setDialogOpen] = useState(true)

  const portalContainer = useMemo(() => container || document.getElementById('center-column-container'), [container])

  const dismiss = useCallback(() => {
    if (shouldUseSmartPostClose(view) && post) {
      const dest = getPostDetailCloseDestination({
        pathname: location.pathname,
        search: location.search,
        post,
        me: currentUser,
        groupSlug
      })
      if (dest) {
        navigate(dest)
        return
      }
    }
    navigate({
      pathname: removePostFromUrl(location.pathname) || '/',
      search: ''
    })
  }, [navigate, location.pathname, location.search, post, currentUser, groupSlug, view])

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
        <Dialog.Overlay
          className='PostDialog-Overlay bg-darkening/50 dark:bg-darkening/90 absolute left-0 right-0 bottom-0 grid place-items-center overflow-y-auto z-[100] h-full backdrop-blur-sm p-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-200'
        >
          <Dialog.Content
            onInteractOutside={handleInteractOutside}
            className='PostDialog-Content min-w-[300px] w-full bg-background p-3 rounded-md z-[41] max-w-[750px] outline-none relative data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-300'
            id='post-dialog-content'
          >
            <Dialog.Title className='sr-only'>Post Dialog</Dialog.Title>
            <Dialog.Description className='sr-only'>Post Dialog</Dialog.Description>
            <PostDetail ref={postDetailRef} inPostDialog onDismissEmbeddedDialog={dismiss} />
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default PostDialog
