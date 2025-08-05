import React, { useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { Route, Routes, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CSSTransition } from 'react-transition-group'
import getPreviousLocation from 'store/selectors/getPreviousLocation'
import CreateModalChooser from './CreateModalChooser'
import CreateGroup from 'components/CreateGroup'
import TrackEditor from 'components/TrackEditor'
import Icon from 'components/Icon'
import PostEditor from 'components/PostEditor'
import { removeCreateEditModalFromUrl } from '@hylo/navigation'
import classes from './CreateModal.module.scss'

const CreateModal = (props) => {
  const location = useLocation()
  const navigate = useNavigate()
  const previousLocation = useSelector(getPreviousLocation) || removeCreateEditModalFromUrl(`${location.pathname}${location.search}`)
  const [returnToLocation] = useState(previousLocation)
  const [isDirty, setIsDirty] = useState()
  const { t } = useTranslation()
  const modalRef = useRef(null)

  const querystringParams = new URLSearchParams(location.search)
  const mapLocation = (querystringParams.has('lat') && querystringParams.has('lng'))
    ? `${querystringParams.get('lat')}, ${querystringParams.get('lng')}`
    : null

  const closeModal = () => {
    // `closePath` is currently only passed in the case of arriving here
    // from the `WelcomeModal` when we want to go back on close or cancel.
    const closePathFromParam = querystringParams.get('closePath')
    navigate(closePathFromParam || returnToLocation)
  }

  const confirmClose = () => {
    const confirmed = !isDirty || window.confirm(t('Changes won\'t be saved. Are you sure you want to cancel?'))

    if (confirmed) {
      closeModal()
    }
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
              />
              )
            : props.editingTrack
              ? (
                <TrackEditor {...props} />
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
                      />
                    )}
                  />
                  <Route path='group' element={<CreateGroup {...props} />} />
                  <Route path='track' element={<TrackEditor {...props} />} />
                  <Route path='*' element={<CreateModalChooser {...props} />} />
                </Routes>
                )}
        </div>
        <div className={classes.createModalBg} onClick={confirmClose} />
      </div>
    </CSSTransition>
  )
}

export default CreateModal
