import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'

import PostDetail from 'routes/PostDetail/PostDetail'

const PostDialog = ({
  container,
  onOpenChange
}) => {
  return (
    <Dialog.Root defaultOpen onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className='bg-black/50 absolute top-0 left-0 right-0 bottom-0 grid place-items-center overflow-y-auto z-50'>
          <Dialog.Content className='min-w-[300px] bg-card p-3 rounded-md z-60 max-w-[750px] m-2 outline-none'>
            <PostDetail />
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default PostDialog
