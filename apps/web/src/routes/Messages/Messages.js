import cx from 'classnames'
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
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
import isPendingFor from 'store/selectors/isPendingFor'
import fetchThreads from 'store/actions/fetchThreads'
import fetchPeople from 'store/actions/fetchPeople'
import fetchRecentContacts from 'store/actions/fetchRecentContacts'
import getPreviousLocation from 'store/selectors/getPreviousLocation'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import getMe from 'store/selectors/getMe'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import CloseMessages from './CloseMessages'
import PeopleSelector from './PeopleSelector'
import ThreadList from './ThreadList'
import Header from './Header'
import MessageSection from './MessageSection'
import MessageForm from './MessageForm'
import PeopleTyping from 'components/PeopleTyping'
import SocketSubscriber from 'components/SocketSubscriber'
import classes from './Messages.module.scss'
import {
  createMessage,
  fetchMessages,
  fetchThread,
  findOrCreateThread,
  updateMessageText,
  updateThreadReadTime,
  setThreadSearch,
  setContactsSearch,
  getContactsList,
  getParticipantsFromQuerystring,
  getTextForCurrentMessageThread,
  getThreadSearch,
  getThreads,
  getThreadsHasMore,
  getMessages,
  getMessagesHasMore,
  getCurrentMessageThread
} from './Messages.store'

export const NEW_THREAD_ID = 'new'

const Messages = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const location = useLocation()
  const routeParams = useParams()
  const { messageThreadId } = routeParams

  // State from mapStateToProps
  const contacts = useSelector(state => getContactsList(state))
  const forParticipants = useSelector(state => getParticipantsFromQuerystring(state, location))
  const prompt = getQuerystringParam('prompt', location)
  const previousLocation = useSelector(state => getPreviousLocation(state))
  const onCloseLocation = useMemo(() => {
    // Only set once, on first load of Messages component
    return previousLocation?.pathname || '/'
  }, [])
  const currentUser = useSelector(getMe)
  // const messageThreadPending = useSelector(state => isPendingFor(fetchThread, state))
  const messageThread = useSelector(state => getCurrentMessageThread(state, routeParams))
  const messageText = useSelector(state => getTextForCurrentMessageThread(state, routeParams))
  const messagesPending = useSelector(state => isPendingFor(fetchMessages, state))
  const threadsPending = useSelector(state =>
    isPendingFor(fetchThreads, state) || isPendingFor(fetchMessages, state)
  )
  const threads = useSelector(state => getThreads(state))
  const hasMoreThreads = useSelector(state => getThreadsHasMore(state))
  const threadSearch = useSelector(state => getThreadSearch(state))
  const messages = useSelector(state => getMessages(state, routeParams))
  const hasMoreMessages = useSelector(state => getMessagesHasMore(state, { id: messageThreadId }))
  const messageCreatePending = useSelector(state =>
    isPendingFor(createMessage, state) || isPendingFor(findOrCreateThread, state)
  )
  const socket = getSocket()

  // Actions from mapDispatchToProps
  const setContactsSearchAction = useCallback((search) => dispatch(setContactsSearch(search)), [])
  const setThreadSearchAction = useCallback((search) => dispatch(setThreadSearch(search)), [])
  const updateMessageTextAction = useCallback((text) => dispatch(updateMessageText(messageThreadId, text)), [messageThreadId])
  const fetchThreadsAction = useCallback(() => dispatch(fetchThreads(20, 0)), [])
  const fetchMoreThreadsAction = useCallback(() => hasMoreThreads && dispatch(fetchThreads(20, 0)), [hasMoreThreads])
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
  const [loading, setLoading] = useState(true)
  const [peopleSelectorOpen, setPeopleSelectorOpen] = useState(false)
  const [participants, setParticipants] = useState([])
  const formRef = useRef(null)

  useEffect(() => {
    const init = async () => {
      await fetchThreadsAction()
      await fetchPeopleAction({})
      setLoading(false)
      onThreadIdChange()

      if (forParticipants) {
        participants.forEach(p => addParticipant(p))
        changeQuerystringParamAction('participants', null)
      }

      if (prompt) {
        updateMessageTextAction(prompt)
        changeQuerystringParamAction('prompt', null)
        focusForm()
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (messageThreadId) {
      onThreadIdChange()
    }
  }, [messageThreadId])

  const onThreadIdChange = () => {
    const newForNewThread = messageThreadId === NEW_THREAD_ID
    setForNewThread(newForNewThread)
    if (!newForNewThread) {
      fetchThreadAction()
    }
    focusForm()
  }

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

  return (
    <div className={cx(classes.modal, { [classes.messagesOpen]: messageThreadId })}>
      <Helmet>
        <title>Messages | Hylo</title>
      </Helmet>
      <div className={classes.content}>
        <div className={classes.messagesHeader}>
          <div className={classes.closeMessages}>
            <CloseMessages onCloseLocation={onCloseLocation} />
          </div>
          <div className={classes.messagesTitle}>
            <Icon name='Messages' />
            {!forNewThread
              ? <h3>{t('Messages')}</h3>
              : <h3>{t('New Message')}</h3>}
          </div>
        </div>
        {loading
          ? <div className={classes.modal}><Loading /></div>
          : (
            <>
              <ThreadList
                className={classes.leftColumn}
                setThreadSearch={setThreadSearchAction}
                onScrollBottom={fetchMoreThreadsAction}
                currentUser={currentUser}
                threadsPending={threadsPending}
                threads={threads}
                messageThreadId={messageThreadId}
                onFocus={() => setPeopleSelectorOpen(false)}
                threadSearch={threadSearch}
              />
              {messageThreadId && (
                <div className={classes.rightColumn}>
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
                        messageThread={messageThread} />}
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
                  </div>
                </div>)}
            </>
            )}
      </div>
    </div>
  )
}

export default Messages
