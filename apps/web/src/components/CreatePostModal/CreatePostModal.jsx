import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CSSTransition } from 'react-transition-group'
import { useTranslation } from 'react-i18next'
import {
  CREATE_POST,
  CREATE_QUERY_PARAM,
  removeCreateEditModalFromUrl,
  stripComposeModalQueryParams
} from '@hylo/navigation'
import UnsavedDraftLeaveDialog from 'components/UnsavedDraftLeaveDialog/UnsavedDraftLeaveDialog'
import Icon from 'components/Icon'
import PostEditor from 'components/PostEditor'
import useRouteParams from 'hooks/useRouteParams'
import { useRegisterHardwareBackHandler } from 'util/hardwareBackHandler'
import classes from './CreatePostModal.module.scss'

/**
 * True for the old `/create` and `/create/post` path suffixes, but not
 * `/members/create` (the invite-members screen).
 */
function isLegacyCreatePostPath (pathname) {
  if (/\/create\/post\/?$/.test(pathname)) return true
  if (/\/members\/create\/?$/.test(pathname)) return false
  return /\/create\/?$/.test(pathname)
}

/**
 * Mounted once by AuthLayoutRouter. Opens for `?create=post` or `/post/:id/edit`
 * so new pages do not need their own create/edit overlay routes.
 */
export default function CreatePostModal () {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const routeParams = useRouteParams()
  const modalRef = useRef(null)
  const postEditorRef = useRef(null)
  const [isDirty, setIsDirty] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const querystringParams = new URLSearchParams(location.search)
  const isLegacyPath = isLegacyCreatePostPath(location.pathname)
  const isEditing = /\/post\/\d+\/edit\/?$/.test(location.pathname)
  const isCreating = querystringParams.get(CREATE_QUERY_PARAM) === CREATE_POST
  const isOpen = !isLegacyPath && (isCreating || isEditing)

  const mapLocation = (querystringParams.has('lat') && querystringParams.has('lng'))
    ? `${querystringParams.get('lat')}, ${querystringParams.get('lng')}`
    : null
  const modalDraftId = `modal:${location.pathname}`

  useEffect(() => {
    if (!isLegacyPath) return
    const params = new URLSearchParams(location.search)
    params.set(CREATE_QUERY_PARAM, CREATE_POST)
    const pathname = location.pathname.replace(/\/create(\/post)?\/?$/, '') || '/'
    navigate({ pathname, search: `?${params.toString()}` }, { replace: true })
  }, [isLegacyPath, location.pathname, location.search, navigate])

  const closeModal = useCallback(() => {
    setShowConfirmDialog(false)
    setIsDirty(false)
    const currentUrl = `${location.pathname}${location.search}`
    const closePathFromParam = new URLSearchParams(location.search).get('closePath')
    const fallback = isEditing
      ? removeCreateEditModalFromUrl(currentUrl)
      : currentUrl
    navigate(stripComposeModalQueryParams(closePathFromParam || fallback), { replace: true })
  }, [isEditing, location.pathname, location.search, navigate])

  const confirmClose = useCallback(() => {
    if (isDirty) {
      setShowConfirmDialog(true)
    } else {
      closeModal()
    }
  }, [closeModal, isDirty])

  const handleDiscardDraft = useCallback(() => {
    postEditorRef.current?.resetToInitial()
    setIsDirty(false)
    closeModal()
  }, [closeModal])

  const handleSaveAndClose = useCallback(() => {
    setShowConfirmDialog(false)
    closeModal()
  }, [closeModal])

  const confirmCloseRef = useRef(confirmClose)
  confirmCloseRef.current = confirmClose

  useRegisterHardwareBackHandler(useCallback(() => {
    if (!isOpen) return false
    if (showConfirmDialog) {
      setShowConfirmDialog(false)
      return true
    }
    confirmCloseRef.current()
    return true
  }, [isOpen, showConfirmDialog]))

  if (!isOpen) return null

  return (
    <CSSTransition
      classNames='createModal'
      appear
      in
      timeout={{ appear: 400, enter: 400, exit: 300 }}
      nodeRef={modalRef}
    >
      <div className={classes.createModal} ref={modalRef}>
        <div className={classes.createModalWrapper} id='create-modal-content'>
          <span className='absolute top-6 right-6 p-2 z-10 cursor-pointer' onClick={confirmClose}>
            <Icon name='Ex' />
          </span>
          <PostEditor
            context={routeParams.context}
            selectedLocation={mapLocation}
            afterSave={closeModal}
            onCancel={confirmClose}
            setIsDirty={setIsDirty}
            editing={isEditing}
            draftId={isEditing ? `${modalDraftId}:edit:${routeParams.postId || ''}` : `${modalDraftId}:create`}
            ref={postEditorRef}
          />
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
