import React, { useRef, useState } from 'react'
import { Route, Routes, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CSSTransition } from 'react-transition-group'
import CreateModalChooser from './CreateModalChooser'
import CreateGroup from 'components/CreateGroup'
import Icon from 'components/Icon'
import PostEditor from 'components/PostEditor'
import classes from './CreateModal.module.scss'

const CreateModal = (props) => {
  const location = useLocation()
  const navigate = useNavigate()
  const [isDirty, setIsDirty] = useState()
  const { t } = useTranslation()
  const modalRef = useRef(null)

  const querystringParams = new URLSearchParams(location.search)
  const mapLocation = (querystringParams.has('lat') && querystringParams.has('lng'))
    ? `${querystringParams.get('lat')}, ${querystringParams.get('lng')}`
    : null

  const closeModal = () => {
    navigate(location.pathname.replace(/\/create.*/, ''))
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
          <span className={classes.closeButton} onClick={confirmClose}>
            <Icon name='Ex' />
          </span>
          {props.editingPost
            ? (
              <PostEditor
                {...props}
                selectedLocation={mapLocation}
                onClose={closeModal}
                onCancel={confirmClose}
                setIsDirty={setIsDirty}
                editing={props.editingPost}
              />
              )
            : (
              <Routes>
                <Route
                  path='post'
                  element={(
                    <PostEditor
                      {...props}
                      selectedLocation={mapLocation}
                      onClose={closeModal}
                      onCancel={confirmClose}
                      setIsDirty={setIsDirty}
                    />
                  )}
                />
                <Route path='group' element={<CreateGroup {...props} />} />
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
