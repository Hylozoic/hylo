import React, { useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { Route, Routes, useNavigate, useLocation } from 'react-router-dom'
import { CSSTransition } from 'react-transition-group'
import getPreviousLocation from 'store/selectors/getPreviousLocation'
import UnsavedDraftLeaveDialog from 'components/UnsavedDraftLeaveDialog/UnsavedDraftLeaveDialog'
import CreateModalChooser from './CreateModalChooser'
import CreateGroup from 'components/CreateGroup'
import FundingRoundEditor from 'components/FundingRoundEditor'
import TrackEditor from 'components/TrackEditor'
import Icon from 'components/Icon'
import PostEditor from 'components/PostEditor'
import { removeCreateEditModalFromUrl, stripComposeModalQueryParams } from '@hylo/navigation'
import classes from './CreateModal.module.scss'
import { useTranslation } from 'react-i18next'

const CreateModal = (props) => {
  const location = useLocation()
  const navigate = useNavigate()
  const previousLocation = useSelector(getPreviousLocation) || removeCreateEditModalFromUrl(`${location.pathname}${location.search}`)
  const [returnToLocation] = useState(previousLocation)
  const [isDirty, setIsDirty] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const modalRef = useRef(null)
  const postEditorRef = useRef(null)
  const { t } = useTranslation()

  const querystringParams = new URLSearchParams(location.search)
  const mapLocation = (querystringParams.has('lat') && querystringParams.has('lng'))
    ? `${querystringParams.get('lat')}, ${querystringParams.get('lng')}`
    : null

  // Use a stable draft namespace so multiple modal instances do not fight over draft context
  const modalDraftId = `modal:${location.pathname}`

  const closeModal = () => {
    setShowConfirmDialog(false)
    setIsDirty(false)
    const closePathFromParam = querystringParams.get('closePath')
    // Use replace to remove the create modal from history.
    // This prevents the back button from re-opening the modal after closing it.
    navigate(stripComposeModalQueryParams(closePathFromParam || returnToLocation), { replace: true })
  }

  const confirmClose = () => {
    if (isDirty) {
      setShowConfirmDialog(true)
    } else {
      closeModal()
    }
  }

  // Discard resets the editor before closing so the next open starts clean
  const handleDiscardDraft = () => {
    postEditorRef.current?.resetToInitial()
    setIsDirty(false)
    closeModal()
  }

  // Save dismisses the modal while leaving the server draft intact so users can resume later
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

        <UnsavedDraftLeaveDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
          title={t('Save draft before closing?')}
          description={t('You have unsaved changes to this post. Save a draft to continue later, or discard them.')}
          onContinueEditing={() => setShowConfirmDialog(false)}
          onDiscard={handleDiscardDraft}
          onSaveDraft={handleSaveAndClose}
        />
      </div>
    </CSSTransition>
  )
}

export default CreateModal
