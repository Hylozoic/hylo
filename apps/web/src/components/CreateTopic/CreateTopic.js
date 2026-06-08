import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'
import { any, arrayOf, object, string, bool } from 'prop-types'
import { debounce, has, get, isEmpty, trim } from 'lodash/fp'
import { Validators } from '@hylo/shared'
import { topicUrl } from '@hylo/navigation'
import Button from 'components/Button'
import Icon from 'components/Icon'
import ModalDialog from 'components/ModalDialog'
import TextInput from 'components/TextInput'
import { MODULE_NAME, fetchGroupTopic, createTopic } from './CreateTopic.store'

import classes from './CreateTopic.module.scss'

function createInitialModalState (t) {
  return {
    modalTitle: t('Create a Topic'),
    modalVisible: false,
    nameError: null,
    loading: false,
    showCancelButton: true,
    showSubmitButton: true,
    submitButtonText: t('Add Topic'),
    topicName: '',
    useNotificationFormat: false,
    redirectTopic: undefined
  }
}

function modalReducer (state, action) {
  switch (action.type) {
    case 'TOGGLE':
      if (state.modalVisible) {
        return { ...createInitialModalState(action.t), redirectTopic: action.redirectTopic }
      }
      return { ...state, modalVisible: true }
    case 'SET_TOPIC_NAME':
      return { ...state, topicName: action.value }
    case 'SET_NAME_ERROR':
      return { ...state, nameError: action.error }
    case 'SET_LOADING':
      return { ...state, loading: action.loading }
    case 'CREATE_SUCCESS':
      return {
        ...state,
        loading: false,
        modalTitle: action.modalTitle,
        showCancelButton: false,
        submitButtonText: action.submitButtonText,
        useNotificationFormat: true
      }
    default:
      return state
  }
}

function ignoreHash (name) {
  return name[0] === '#' ? name.slice(1) : name
}

export default function CreateTopic ({
  buttonText,
  groupId,
  groupSlug,
  topics = [],
  subscribeAfterCreate
}) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const groupTopicExists = useSelector(state => state[MODULE_NAME])

  const createTopicBound = useCallback((a, b, c, d) => dispatch(createTopic(a, b, c, d)), [dispatch])
  const fetchGroupTopicBound = useCallback((name, slug) => dispatch(fetchGroupTopic(name, slug)), [dispatch])

  const [modal, dispatchModal] = useReducer(modalReducer, t, (t0) => createInitialModalState(t0))

  const {
    modalTitle,
    modalVisible,
    nameError,
    loading,
    showCancelButton,
    showSubmitButton,
    submitButtonText,
    topicName,
    useNotificationFormat,
    redirectTopic
  } = modal

  const safeTopicName = useCallback(() => trim(ignoreHash(topicName)), [topicName])

  const validateDebounced = useRef()
  useEffect(() => {
    validateDebounced.current = debounce(500, (value) => {
      dispatchModal({
        type: 'SET_NAME_ERROR',
        error: Validators.validateTopicName(ignoreHash(value))
      })
    })
  }, [])

  const toggleTopicModal = useCallback((redirectTopicArg) => {
    dispatchModal({ type: 'TOGGLE', redirectTopic: redirectTopicArg, t })
  }, [t])

  const createAndNotify = useCallback((name) => {
    createTopicBound(name, groupId, false, !!subscribeAfterCreate)
    dispatchModal({
      type: 'CREATE_SUCCESS',
      modalTitle: t('Topic Created'),
      submitButtonText: t('Ok')
    })
  }, [createTopicBound, groupId, subscribeAfterCreate, t])

  const subscribeAndRedirect = useCallback((name) => {
    createTopicBound(name, groupId, false, !!subscribeAfterCreate)
    toggleTopicModal(name)
  }, [createTopicBound, groupId, subscribeAfterCreate, toggleTopicModal])

  const prevGroupTopicExists = useRef(groupTopicExists)
  useEffect(() => {
    const name = safeTopicName()
    const topicPath = ['groupTopicExists', encodeURI(name), groupSlug]
    const prevWrap = { groupTopicExists: prevGroupTopicExists.current }
    const nextWrap = { groupTopicExists }
    if (
      !isEmpty(name) &&
      !has(topicPath, prevWrap) &&
      has(topicPath, nextWrap)
    ) {
      if (get(topicPath, nextWrap)) {
        subscribeAndRedirect(name)
      } else {
        createAndNotify(name)
      }
    }
    prevGroupTopicExists.current = groupTopicExists
  }, [groupTopicExists, topicName, groupSlug, safeTopicName, subscribeAndRedirect, createAndNotify])

  const submitButtonAction = useCallback(() => {
    const name = safeTopicName()
    if (isEmpty(name)) {
      dispatchModal({ type: 'SET_NAME_ERROR', error: t('Topic name is required.') })
      return
    }

    const existingTopic = topics.find(topicItem => topicItem.name === name)
    if (existingTopic && subscribeAfterCreate) {
      subscribeAndRedirect(name)
      return
    }

    if (!loading && !has(`${name}.${groupSlug}`, groupTopicExists)) {
      dispatchModal({ type: 'SET_LOADING', loading: true })
      fetchGroupTopicBound(name, groupSlug)
      return
    }

    toggleTopicModal()
  }, [
    safeTopicName,
    t,
    topics,
    subscribeAfterCreate,
    subscribeAndRedirect,
    loading,
    groupSlug,
    groupTopicExists,
    fetchGroupTopicBound,
    toggleTopicModal
  ])

  const submitButtonIsDisabled = useCallback(() => {
    return isEmpty(topicName) || !!nameError
  }, [topicName, nameError])

  const handleTopicNameChange = useCallback(({ target }) => {
    if (target.value !== '') {
      validateDebounced.current(target.value)
    }
    dispatchModal({ type: 'SET_TOPIC_NAME', value: target.value })
  }, [])

  const handleToggleTopicModal = useCallback(() => {
    toggleTopicModal()
  }, [toggleTopicModal])

  const buttonChooser = useMemo(() => (
    buttonText
      ? (
        <Button
          color='green-white-green-border'
          key='create-button'
          narrow
          onClick={handleToggleTopicModal}
          className={classes.createTopic}
        >
          <Icon name='Plus' green className={classes.plus} />{buttonText}
        </Button>
        )
      : (
        <Icon
          key='create-button'
          name='Plus'
          dataTestId='icon-Plus'
          onClick={handleToggleTopicModal}
          className={classes.createButton}
        />
        )
  ), [buttonText, handleToggleTopicModal])

  if (redirectTopic && subscribeAfterCreate) {
    const url = topicUrl(encodeURI(redirectTopic), { groupSlug })
    if (url !== window.location.pathname) return <Navigate to={url} replace />
  }

  return (
    <>
      {buttonChooser}
      {modalVisible && (
        <ModalDialog
          key='create-dialog'
          backgroundImage='axolotl-corner.png'
          closeModal={handleToggleTopicModal}
          closeOnSubmit={false}
          modalTitle={modalTitle}
          notificationIconName='Star'
          showCancelButton={showCancelButton}
          showSubmitButton={showSubmitButton}
          submitButtonAction={submitButtonAction}
          submitButtonIsDisabled={submitButtonIsDisabled}
          submitButtonText={submitButtonText}
          useNotificationFormat={useNotificationFormat}
        >
          {useNotificationFormat
            ? (subscribeAfterCreate
                ? <div className={classes.dialogContent}>{t('you\'re subscribed to #{{topicName}}', { topicName: ignoreHash(topicName) })}</div>
                : <div className={classes.dialogContent}>{t('Created topic #{{topicName}}', { topicName: ignoreHash(topicName) })}</div>
              )
            : (
              <div>
                <TextInput
                  aria-label='topic-name'
                  autoFocus
                  label='topic-name'
                  name='topic-name'
                  onChange={handleTopicNameChange}
                  loading={loading}
                  placeholder={t('Enter a topic name:')}
                  value={topicName}
                />
                {nameError && <div className={classes.topicError}>{nameError}</div>}
              </div>
              )}
        </ModalDialog>
      )}
    </>
  )
}

CreateTopic.propTypes = {
  buttonText: string,
  groupId: any,
  groupSlug: string,
  topics: arrayOf(object),
  subscribeAfterCreate: bool
}
