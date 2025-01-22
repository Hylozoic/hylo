import { cn } from 'util/index'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { get, isEmpty } from 'lodash/fp'
import { TextHelpers } from '@hylo/shared'
import { getSocket, sendIsTyping } from 'client/websockets'
import { push } from 'redux-first-history'
import { messageThreadUrl } from 'util/navigation'
import changeQuerystringParam from 'store/actions/changeQuerystringParam'
import { FETCH_PEOPLE } from 'store/constants'
import isPendingFor from 'store/selectors/isPendingFor'
import fetchPeople from 'store/actions/fetchPeople'
import fetchRecentContacts from 'store/actions/fetchRecentContacts'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import getMe from 'store/selectors/getMe'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import PeopleSelector from './PeopleSelector'
import Header from './Header'
import MessageSection from './MessageSection'
import MessageForm from './MessageForm'
import PeopleTyping from 'components/PeopleTyping'
import SocketSubscriber from 'components/SocketSubscriber'
import { useViewHeader } from 'contexts/ViewHeaderContext'

import {
  createMessage,
  fetchMessages,
  fetchThread,
  findOrCreateThread,
  updateMessageText,
  updateThreadReadTime,
  setContactsSearch,
  getContactsList,
  getParticipantsFromQuerystring,
  getTextForCurrentMessageThread,
  getMessages,
  getMessagesHasMore,
  getCurrentMessageThread
} from './Messages.store'

import classes from './Messages.module.scss'

export const NEW_THREAD_ID = 'new'

const Messages = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const location = useLocation()
  const routeParams = useParams()
  const { messageThreadId } = routeParams
  console.log('messageThreadId', messageThreadId)

  // State from mapStateToProps
  const contacts = useSelector(state => getContactsList(state))
  const forParticipants = useSelector(state => getParticipantsFromQuerystring(state, location))
  const prompt = getQuerystringParam('prompt', location)
  const currentUser = useSelector(getMe)
  // const messageThreadPending = useSelector(state => isPendingFor(fetchThread, state))
  const messageThread = useSelector(state => getCurrentMessageThread(state, routeParams))
  const messageText = useSelector(state => getTextForCurrentMessageThread(state, routeParams))
  const messagesPending = useSelector(state => isPendingFor(fetchMessages, state))
  const peoplePending = useSelector(state => isPendingFor(FETCH_PEOPLE, state))
  const messages = useSelector(state => getMessages(state, routeParams))
  const hasMoreMessages = useSelector(state => getMessagesHasMore(state, { id: messageThreadId }))
  const messageCreatePending = useSelector(state =>
    isPendingFor(createMessage, state) || isPendingFor(findOrCreateThread, state)
  )
  const socket = getSocket()

  // Actions from mapDispatchToProps
  const setContactsSearchAction = useCallback((search) => dispatch(setContactsSearch(search)), [])
  const updateMessageTextAction = useCallback((text) => dispatch(updateMessageText(messageThreadId, text)), [messageThreadId])
  const fetchMessagesAction = useCallback(() => {
    const fetchMessagesCursor = !isEmpty(messages) && messages[0].id
    dispatch(fetchMessages(messageThreadId, { cursor: fetchMessagesCursor }))
  }, [dispatch, messageThreadId, messages])
  const findOrCreateThreadAction = useCallback((participantIds) => dispatch(findOrCreateThread(participantIds)), [dispatch])
  const createMessageAction = useCallback((threadId, text, isNew) => dispatch(createMessage(threadId, text, isNew)), [dispatch])
  const changeQuerystringParamAction = useCallback((param, value) => dispatch(changeQuerystringParam(location, param, value)), [location])
  const fetchRecentContactsAction = useCallback(() => dispatch(fetchRecentContacts()), [dispatch])
  const fetchPeopleAction = useCallback((options) => dispatch(fetchPeople(options)), [dispatch])
  const updateThreadReadTimeAction = useCallback((threadId, time) => dispatch(updateThreadReadTime(threadId, time)), [dispatch])
  const fetchThreadAction = useCallback(() => dispatch(fetchThread(messageThreadId)), [dispatch, messageThreadId])
  const goToThreadAction = useCallback((threadId) => dispatch(push(messageThreadUrl(threadId))), [dispatch])

  const [forNewThread, setForNewThread] = useState(messageThreadId === NEW_THREAD_ID)
  const [peopleSelectorOpen, setPeopleSelectorOpen] = useState(false)
  const [participants, setParticipants] = useState([])
  const formRef = useRef(null)

  useEffect(() => {
    fetchPeopleAction({})

    if (forParticipants) {
      forParticipants.forEach(p => addParticipant(p))
      changeQuerystringParamAction('participants', null)
    }

    if (prompt) {
      updateMessageTextAction(prompt)
      changeQuerystringParamAction('prompt', null)
      focusForm()
    }
  }, [])

  useEffect(() => {
    if (messageThreadId) {
      const newForNewThread = messageThreadId === NEW_THREAD_ID
      setForNewThread(newForNewThread)
      if (!newForNewThread) {
        fetchThreadAction()
      }
      focusForm()
    }
  }, [messageThreadId])

  const sendMessage = () => {
    if (!messageText || messageCreatePending) return false
    setParticipants([])
    if (forNewThread) {
      sendNewMessage()
    } else {
      sendForExisting()
    }
    return false
  }

  const sendForExisting = () => {
    createMessageAction(messageThreadId, TextHelpers.markdown(messageText)).then(() => focusForm())
  }

  const sendNewMessage = async () => {
    const participantIds = participants.map(p => p.id)
    const createThreadResponse = await findOrCreateThreadAction(participantIds)
    const newMessageThreadId = get('payload.data.findOrCreateThread.id', createThreadResponse) ||
      get('data.findOrCreateThread.id', createThreadResponse)
    await createMessageAction(newMessageThreadId, TextHelpers.markdown(messageText), true)
    goToThreadAction(newMessageThreadId)
  }

  const addParticipant = (participant) => {
    setParticipants(prevParticipants => [...prevParticipants, participant])
  }

  const removeParticipant = (participant) => {
    setParticipants(prevParticipants =>
      !participant
        ? prevParticipants.slice(0, prevParticipants.length - 1)
        : prevParticipants.filter(p => p.id !== participant.id)
    )
  }

  const focusForm = () => formRef.current && formRef.current.focus()

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({ title: forNewThread ? t('New Message') : t('Messages'), icon: 'Messages' })
  }, [forNewThread])

  return (
    <div className={cn({ [classes.messagesOpen]: messageThreadId })}>
      <Helmet>
        <title>Messages | Hylo</title>
      </Helmet>
      <div className={classes.content}>
        {peoplePending
          ? <div><Loading /></div>
          : (
            <>
              {messageThreadId && (
                <div className={classes.thread}>
                  {forNewThread &&
                    <div>
                      <div className={classes.newThreadHeader}>
                        <Link to='/messages' className={classes.backButton}>
                          <Icon name='ArrowForward' className={classes.closeMessagesIcon} />
                        </Link>
                        <div className={classes.messagesTitle}>
                          <Icon name='Messages' />
                          <h3>{t('New Message')}</h3>
                        </div>
                      </div>
                      <PeopleSelector
                        currentUser={currentUser}
                        fetchPeople={fetchPeopleAction}
                        fetchDefaultList={fetchRecentContactsAction}
                        focusMessage={focusForm}
                        setPeopleSearch={setContactsSearchAction}
                        people={contacts}
                        onFocus={() => setPeopleSelectorOpen(true)}
                        selectedPeople={participants}
                        selectPerson={addParticipant}
                        removePerson={removeParticipant}
                        peopleSelectorOpen={peopleSelectorOpen}
                      />
                    </div>}
                  {!forNewThread && messageThreadId &&
                    <Header
                      messageThread={messageThread}
                      currentUser={currentUser}
                      pending={messagesPending}
                    />}
                  {!forNewThread &&
                    <MessageSection
                      socket={socket}
                      currentUser={currentUser}
                      fetchMessages={fetchMessagesAction}
                      messages={messages}
                      hasMore={hasMoreMessages}
                      pending={messagesPending}
                      updateThreadReadTime={updateThreadReadTimeAction}
                      messageThread={messageThread}
                    />}
                  {(!forNewThread || participants.length > 0) &&
                    <div className={classes.messageForm}>
                      <MessageForm
                        onSubmit={sendMessage}
                        onFocus={() => setPeopleSelectorOpen(false)}
                        currentUser={currentUser}
                        ref={formRef}
                        updateMessageText={updateMessageTextAction}
                        messageText={messageText}
                        sendIsTyping={sendIsTyping}
                        pending={messageCreatePending}
                      />
                    </div>}
                  <PeopleTyping className={classes.peopleTyping} />
                  {socket && <SocketSubscriber type='post' id={messageThreadId} />}
                </div>)}
            </>
            )}
      </div>
    </div>
  )
}

export default Messages
