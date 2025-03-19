import React, { Suspense, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'

import Loading from 'components/Loading/Loading'
import { removePostFromUrl } from 'util/navigation'

const PostDetail = React.lazy(() => import('routes/PostDetail/PostDetail'))

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
  }, [])

  const handleInteractOutside = useCallback((e) => {
    if (e.target.className.includes('fsp') || e.target.children[0].className.includes('fsp')) {
      // Don't close the dialog if the user is interacting with the filestack picker
      e.preventDefault()
      return false
    }
  }, [])

  return (
    <Dialog.Root defaultOpen onOpenChange={handleOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className='PostDialog-Overlay bg-black/50 absolute top-0 left-0 right-0 bottom-0 grid place-items-center overflow-y-auto z-[40] backdrop-blur-sm'>
          <Dialog.Content onInteractOutside={handleInteractOutside} className='PostDialog-Content min-w-[300px] w-full bg-background p-3 rounded-md z-[41] max-w-[750px] outline-none'>
            <Dialog.Title className='sr-only'>Post Dialog</Dialog.Title>
            <Dialog.Description className='sr-only'>Post Dialog</Dialog.Description>
            <Suspense fallback={<Loading />}>
              <PostDetail />
            </Suspense>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default PostDialog
