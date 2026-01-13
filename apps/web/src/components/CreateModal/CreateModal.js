import React, { useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { Route, Routes, useNavigate, useLocation } from 'react-router-dom'
import { CSSTransition } from 'react-transition-group'
import * as Dialog from '@radix-ui/react-dialog'
import getPreviousLocation from 'store/selectors/getPreviousLocation'
import CreateModalChooser from './CreateModalChooser'
import CreateGroup from 'components/CreateGroup'
import FundingRoundEditor from 'components/FundingRoundEditor'
import TrackEditor from 'components/TrackEditor'
import Icon from 'components/Icon'
import PostEditor from 'components/PostEditor'
import { removeCreateEditModalFromUrl } from '@hylo/navigation'
import useDraftStorage from 'hooks/useDraftStorage'
import classes from './CreateModal.module.scss'

const CreateModal = (props) => {
  const location = useLocation()
  const navigate = useNavigate()
  const previousLocation = useSelector(getPreviousLocation) || removeCreateEditModalFromUrl(`${location.pathname}${location.search}`)
  const [returnToLocation] = useState(previousLocation)
  const [isDirty, setIsDirty] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const modalRef = useRef(null)
  const postEditorRef = useRef(null)

  const querystringParams = new URLSearchParams(location.search)
  const mapLocation = (querystringParams.has('lat') && querystringParams.has('lng'))
    ? `${querystringParams.get('lat')}, ${querystringParams.get('lng')}`
    : null

  // Use a stable draft namespace so multiple modal instances do not fight over stored values
  // Draft state is stored per-modal instance so pending posts survive navigation without leaking between flows
  const modalDraftId = `modal:${location.pathname}${location.search}`
  const createDraftKey = `${modalDraftId}:create`
  const editDraftKey = props.post?.id ? `${modalDraftId}:edit:${props.post.id}` : null
  const { clearDraft: clearCreateDraft } = useDraftStorage(createDraftKey)
  const { clearDraft: clearEditDraft } = useDraftStorage(editDraftKey)

  const closeModal = () => {
    setShowConfirmDialog(false)
    setIsDirty(false)
    const closePathFromParam = querystringParams.get('closePath')
    navigate(closePathFromParam || returnToLocation)
  }

  const confirmClose = () => {
    if (isDirty) {
      setShowConfirmDialog(true)
    } else {
      closeModal()
    }
  }

  // Discard wipes the stored draft and resets the editor before closing so the next open starts clean
  const handleDiscardDraft = () => {
    if (props.editingPost && editDraftKey) {
      clearEditDraft()
    } else {
      clearCreateDraft()
    }
    postEditorRef.current?.resetToInitial()
    setIsDirty(false)
    closeModal()
  }

  // Save dismisses the modal while leaving the current draft in local storage so users can resume later
  const handleSaveAndClose = () => {
    setShowConfirmDialog(false)
    closeModal()
  }

  return (
    <CSSTransition
      classNames='createModal'
      appear
      in
      timeout={{ appear: 400, enter: 400, exit: 300 }}
      nodeRef={modalRef}
    >
      <div className={classes.createModal} ref={modalRef}>
        <div className={classes.createModalWrapper}>
          <span className='absolute top-6 right-6 p-2 z-10 cursor-pointer' onClick={confirmClose}>
            <Icon name='Ex' />
          </span>
          {props.editingPost
            ? (
              <PostEditor
                {...props}
                selectedLocation={mapLocation}
                afterSave={closeModal}
                onCancel={confirmClose}
                setIsDirty={setIsDirty}
                editing={props.editingPost}
                draftId={`${modalDraftId}:edit:${props.post?.id || ''}`}
                ref={postEditorRef}
              />
              )
            : props.editingTrack
              ? (
                <TrackEditor {...props} />
                )
              : props.editingFundingRound
                ? (
                  <FundingRoundEditor {...props} editingRound />
                  )
                : (
                  <Routes>
                    <Route
                      path='post'
                      element={(
                        <PostEditor
                          {...props}
                          selectedLocation={mapLocation}
                          afterSave={closeModal}
                          onCancel={confirmClose}
                          setIsDirty={setIsDirty}
                          draftId={`${modalDraftId}:create`}
                          ref={postEditorRef}
                        />
                      )}
                    />
                    <Route path='group' element={<CreateGroup {...props} />} />
                    <Route path='track' element={<TrackEditor {...props} />} />
                    <Route path='funding-round' element={<FundingRoundEditor {...props} />} />
                    <Route path='*' element={<CreateModalChooser {...props} />} />
                  </Routes>
                  )}
        </div>
        <div className={classes.createModalBg} onClick={confirmClose} />

        <Dialog.Root open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <Dialog.Portal>
            <Dialog.Overlay className='fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm' />
            <Dialog.Content className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
              <div className='bg-background text-foreground rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4'>
                <Dialog.Title className='text-lg font-semibold'>Discard draft?</Dialog.Title>
                <Dialog.Description className='text-sm text-foreground/70'>Closing now will discard the changes you have made to this post.</Dialog.Description>
                <div className='flex justify-end gap-3'>
                  <Dialog.Close asChild>
                    <button className='rounded-lg px-4 py-2 text-sm border border-foreground/20 hover:bg-foreground/10 transition-colors' onClick={() => setShowConfirmDialog(false)}>
                      Continue editing
                    </button>
                  </Dialog.Close>
                  <button className='rounded-lg px-4 py-2 text-sm border border-foreground/20 hover:bg-foreground/10 transition-colors' onClick={handleSaveAndClose}>
                    Save
                  </button>
                  <Dialog.Close asChild>
                    <button className='rounded-lg px-4 py-2 text-sm text-white bg-destructive hover:bg-destructive/80 transition-colors' onClick={handleDiscardDraft}>
                      Discard
                    </button>
                  </Dialog.Close>
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </CSSTransition>
  )
}

export default CreateModal
