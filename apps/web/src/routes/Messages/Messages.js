import { cn } from 'util/index'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { get, isEmpty } from 'lodash/fp'
import { TextHelpers } from '@hylo/shared'
import { getSocket, sendIsTyping } from 'client/websockets'
import { push } from 'redux-first-history'
import { messageThreadUrl } from '@hylo/navigation'
import changeQuerystringParam from 'store/actions/changeQuerystringParam'
import isPendingFor from 'store/selectors/isPendingFor'
import fetchPeople from 'store/actions/fetchPeople'
import fetchRecentContacts from 'store/actions/fetchRecentContacts'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import getMe from 'store/selectors/getMe'
import getMyMemberships from 'store/selectors/getMyMemberships'
import useDraft from 'hooks/useDraft'
import PeopleSelector from './PeopleSelector'
import Header from './Header'
import MessageSection from './MessageSection'
import MessageForm from './MessageForm'
import PeopleTyping from 'components/PeopleTyping'
import SocketSubscriber from 'components/SocketSubscriber'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { isMobileDevice, isPhoneDevice } from 'util/mobile'
import MessagesMobile from './MessagesMobile'
import { canAddThreadParticipant } from './messageThreadLimits'
import MutedThreadNotice from './MutedThreadNotice'

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
  getCurrentMessageThread,
  NEW_THREAD_ID
} from './Messages.store'

import classes from './Messages.module.scss'

// Message stream width control, mirroring the chat room's
const DM_STREAM_WIDTH_KEY = 'hylo-dm-stream-width'
const MIN_DM_STREAM_WIDTH = 400
const DEFAULT_DM_STREAM_WIDTH = 750
const DM_RAIL_WIDTH = 14
const DM_RAIL_SLACK = 40

const Messages = () => {
  const dispatch = useDispatch()
  const location = useLocation()
  const routeParams = useParams()
  const { t } = useTranslation()
  const { messageThreadId } = routeParams

  // State from mapStateToProps
  const contacts = useSelector(state => getContactsList(state))
  const forParticipants = useSelector(state => getParticipantsFromQuerystring(state, location))
  const prompt = getQuerystringParam('prompt', location)
  const currentUser = useSelector(getMe)
  const memberships = useSelector(getMyMemberships)
  // const messageThreadPending = useSelector(state => isPendingFor(fetchThread, state))
  const messageThread = useSelector(state => getCurrentMessageThread(state, routeParams))
  const messageText = useSelector(state => getTextForCurrentMessageThread(state, routeParams))
  const messagesPending = useSelector(state => isPendingFor(fetchMessages, state))
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
  const fetchPeopleAction = useCallback((options) => {
    // Always include groupIds to ensure we only show people who share a group
    const groupIds = memberships.map(m => m.group?.id).filter(Boolean)
    return dispatch(fetchPeople({ ...options, groupIds }))
  }, [dispatch, memberships])
  const updateThreadReadTimeAction = useCallback((threadId, time) => dispatch(updateThreadReadTime(threadId, time)), [dispatch])
  const fetchThreadAction = useCallback(() => dispatch(fetchThread(messageThreadId)), [dispatch, messageThreadId])
  const goToThreadAction = useCallback((threadId) => dispatch(push(messageThreadUrl(threadId))), [dispatch])

  const [forNewThread, setForNewThread] = useState(messageThreadId === NEW_THREAD_ID)
  // Starting a new thread opens the recipient picker immediately
  const [peopleSelectorOpen, setPeopleSelectorOpen] = useState(messageThreadId === NEW_THREAD_ID)
  const [participants, setParticipants] = useState([])
  const formRef = useRef(null)
  const peopleSelectorRef = useRef(null)
  /** Avoid re-applying server draft whenever draft ORM updates (e.g. after saves). */
  const messageDraftRestoreDoneRef = useRef(false)
  /** Composer had non-empty text this visit (typed or restored) — used to delete server draft when cleared. */
  const messageComposerHadTrimmedContentRef = useRef(false)

  // ── Resizable message stream width (same affordance as the chat room) ────
  const [dmStreamWidth, setDmStreamWidth] = useState(() => {
    const saved = parseInt(window.localStorage.getItem(DM_STREAM_WIDTH_KEY), 10)
    return Number.isFinite(saved) ? Math.max(saved, MIN_DM_STREAM_WIDTH) : DEFAULT_DM_STREAM_WIDTH
  })
  const [dmPaneEl, setDmPaneEl] = useState(null)
  const [dmPaneWidth, setDmPaneWidth] = useState(0)
  const [resizingDmWidth, setResizingDmWidth] = useState(false)
  const dmResizeDragRef = useRef(null)

  useEffect(() => {
    if (!dmPaneEl) return
    const observer = new ResizeObserver(entries => {
      setDmPaneWidth(entries[0]?.contentRect?.width ?? 0)
    })
    observer.observe(dmPaneEl)
    return () => observer.disconnect()
  }, [dmPaneEl])

  const dmAvailableWidth = Math.max(0, dmPaneWidth - DM_RAIL_WIDTH - 4)
  const effectiveDmWidth = dmAvailableWidth ? Math.min(dmStreamWidth, dmAvailableWidth) : dmStreamWidth
  const showDmRail = dmAvailableWidth >= Math.min(dmStreamWidth, DEFAULT_DM_STREAM_WIDTH) + DM_RAIL_SLACK

  const onDmRailPointerDown = useCallback((e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dmResizeDragRef.current = { startX: e.clientX, startWidth: effectiveDmWidth }
    setResizingDmWidth(true)
  }, [effectiveDmWidth])

  const onDmRailPointerMove = useCallback((e) => {
    const drag = dmResizeDragRef.current
    if (!drag) return
    const next = Math.min(Math.max(drag.startWidth + e.clientX - drag.startX, MIN_DM_STREAM_WIDTH), dmAvailableWidth)
    setDmStreamWidth(next)
  }, [dmAvailableWidth])

  const onDmRailPointerUp = useCallback(() => {
    if (!dmResizeDragRef.current) return
    dmResizeDragRef.current = null
    setResizingDmWidth(false)
    setDmStreamWidth(width => {
      window.localStorage.setItem(DM_STREAM_WIDTH_KEY, String(Math.round(width)))
      return width
    })
  }, [])

  const isRealThread = messageThreadId && messageThreadId !== NEW_THREAD_ID
  const { loadedData: messageDraftData, isLoaded: messageDraftLoaded, saveDraft: saveMessageDraft, clearDraft: clearMessageDraft } = useDraft({
    type: 'message',
    messageThreadId: isRealThread ? messageThreadId : undefined,
    navigateTo: `/messages/${messageThreadId}`,
    debounceMs: 800,
    skip: !isRealThread || !currentUser
  })

  useEffect(() => {
    // Get group IDs from user's memberships to filter people who share a group
    const groupIds = memberships.map(m => m.group?.id).filter(Boolean)
    if (groupIds.length > 0) {
      fetchPeopleAction({ groupIds })
    }

    if (forParticipants) {
      forParticipants.forEach(p => addParticipant(p))
      changeQuerystringParamAction('participants', null)
    }

    if (prompt) {
      updateMessageTextAction(prompt)
      changeQuerystringParamAction('prompt', null)
      focusForm()
    }
  }, [memberships])

  useEffect(() => {
    if (messageThreadId) {
      const newForNewThread = messageThreadId === NEW_THREAD_ID
      setForNewThread(newForNewThread)
      setPeopleSelectorOpen(newForNewThread)
      if (!newForNewThread) {
        fetchThreadAction()
      }
    }
    focusForm()
  }, [messageThreadId])

  // Clicking anywhere outside the recipient picker closes its dropdown.
  // The dropdown itself portals to document.body, so it needs its own check —
  // treating it as "outside" here would close it on mousedown and swallow the
  // click before the person could be selected.
  useEffect(() => {
    if (!peopleSelectorOpen) return
    const handlePointerDown = (e) => {
      if (e.target.closest?.('[data-people-selector-dropdown]')) return
      if (peopleSelectorRef.current && !peopleSelectorRef.current.contains(e.target)) {
        setPeopleSelectorOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [peopleSelectorOpen])

  useEffect(() => {
    messageDraftRestoreDoneRef.current = false
    messageComposerHadTrimmedContentRef.current = false
  }, [messageThreadId])

  // Load server draft into Redux message text once per thread when the draft loads
  useEffect(() => {
    if (!messageDraftLoaded || messageDraftRestoreDoneRef.current) return
    messageDraftRestoreDoneRef.current = true
    if (!messageDraftData) return
    // Only restore if there's no current text (don't overwrite what user is typing)
    if (!messageText) {
      try {
        const parsed = JSON.parse(messageDraftData)
        updateMessageTextAction(parsed?.text || messageDraftData)
      } catch {
        updateMessageTextAction(messageDraftData)
      }
    }
  }, [messageDraftLoaded, messageDraftData])

  // Debounce-save message text to server as user types; empty string cancels stale saves via useDraft
  useEffect(() => {
    if (!isRealThread || !currentUser) return
    saveMessageDraft(JSON.stringify({ text: messageText || '' }))
  }, [messageText, isRealThread, currentUser, saveMessageDraft])

  // When the user clears the composer after it had content, remove the server draft so
  // navigating away and back does not reload old text.
  useEffect(() => {
    if (!isRealThread || !currentUser) return
    if (messageText?.trim()) {
      messageComposerHadTrimmedContentRef.current = true
      return
    }
    if (!messageComposerHadTrimmedContentRef.current) return
    messageComposerHadTrimmedContentRef.current = false
    clearMessageDraft({ deleteOnServer: true })
  }, [messageText, isRealThread, currentUser, clearMessageDraft])

  const sendMessage = async () => {
    if (!messageText || messageCreatePending) return false
    if (forNewThread) {
      await sendNewMessage()
    } else {
      await sendForExisting()
    }
    clearMessageDraft({ deleteOnServer: true })
    setParticipants([])
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
    setParticipants(prevParticipants => {
      if (!canAddThreadParticipant([...prevParticipants, participant], currentUser?.id)) {
        return prevParticipants
      }
      return [...prevParticipants, participant]
    })
  }

  const removeParticipant = (participant) => {
    setParticipants(prevParticipants =>
      !participant
        ? prevParticipants.slice(0, prevParticipants.length - 1)
        : prevParticipants.filter(p => p.id !== participant.id)
    )
  }

  const focusForm = () => {
    if (formRef.current) {
      // Use preventScroll on mobile to avoid double scrolling (Visual Viewport API handles it)
      if (isMobileDevice()) {
        formRef.current.focus({ preventScroll: true })
      } else {
        formRef.current.focus()
      }
    }
  }

  const header = forNewThread
    ? (
      <div ref={peopleSelectorRef}>
        <PeopleSelector
          currentUser={currentUser}
          fetchPeople={fetchPeopleAction}
          fetchDefaultList={fetchRecentContactsAction}
          focusMessage={focusForm}
          setPeopleSearch={setContactsSearchAction}
          people={contacts}
          onFocus={() => setPeopleSelectorOpen(true)}
          onTyping={() => setPeopleSelectorOpen(true)}
          selectedPeople={participants}
          selectPerson={addParticipant}
          removePerson={removeParticipant}
          peopleSelectorOpen={peopleSelectorOpen}
          autoFocus={forNewThread}
          maxParticipantsReached={!canAddThreadParticipant(participants, currentUser?.id)}
        />
      </div>
      )
    : (
      <Header
        messageThread={messageThread}
        currentUser={currentUser}
        threadId={messageThreadId}
      />
      )

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    // Don't set header details on phones - MessagesMobile handles its own header.
    // The recipients/thread header renders inside the conversation column below,
    // so the shared ViewHeader (which spans the inbox too) stays a plain title.
    if (!isPhoneDevice()) {
      setHeaderDetails({
        title: t('Messages'),
        icon: 'Messages',
        search: false
      })
    }
  }, [t])

  // Render mobile version on phones only; tablets use the desktop side-by-side layout
  if (isPhoneDevice()) {
    return (
      <MessagesMobile
        messageThreadId={messageThreadId}
        messageThread={messageThread}
        messages={messages}
        hasMoreMessages={hasMoreMessages}
        messagesPending={messagesPending}
        messageText={messageText}
        messageCreatePending={messageCreatePending}
        currentUser={currentUser}
        socket={socket}
        forNewThread={forNewThread}
        setForNewThread={setForNewThread}
        participants={participants}
        setParticipants={setParticipants}
        peopleSelectorOpen={peopleSelectorOpen}
        setPeopleSelectorOpen={setPeopleSelectorOpen}
        contacts={contacts}
        formRef={formRef}
        focusForm={focusForm}
        sendMessage={sendMessage}
        fetchMessagesAction={fetchMessagesAction}
        updateThreadReadTimeAction={updateThreadReadTimeAction}
        fetchPeopleAction={fetchPeopleAction}
        fetchRecentContactsAction={fetchRecentContactsAction}
        setContactsSearchAction={setContactsSearchAction}
        updateMessageTextAction={updateMessageTextAction}
        addParticipant={addParticipant}
        removeParticipant={removeParticipant}
      />
    )
  }

  return (
    <div className={cn('flex flex-col h-full flex-1 min-w-0 w-full', { [classes.messagesOpen]: messageThreadId })}>
      <Helmet>
        <title>Messages | Hylo</title>
      </Helmet>
      {messageThreadId && (
        <div className='flex flex-col h-full w-full min-w-0 px-3'>
          {/* The recipients/thread header belongs to this column only — it must
              not span the inbox list beside it. Styled like ViewHeader: same
              hairline edge and shadow floating above the message stream. */}
          <div className='flex-shrink-0 z-20 -mx-3 px-4 py-2 bg-background border-b border-foreground/[0.08] shadow-[0_4px_14px_0px_rgba(0,0,0,0.16)] dark:border-transparent dark:shadow-[0_4px_15px_0px_rgba(0,0,0,0.1)]'>
            {header}
          </div>
          <div
            ref={setDmPaneEl}
            className='relative flex flex-col flex-1 min-h-0 min-w-0'
            style={{ '--dm-stream-width': `${effectiveDmWidth}px` }}
          >
            <div className='relative flex flex-col flex-1 min-h-0 min-w-0'>
              {/* Width rail on the stream's clamp edge, same affordance as chat.
                  Bounded to the list so its bottom hint sits above the input. */}
              {showDmRail && (
                <div
                  role='separator'
                  aria-orientation='vertical'
                  aria-label={t('Adjust message width')}
                  className={cn(
                    'absolute top-0 bottom-0 z-20 flex flex-col items-center justify-between group touch-none select-none',
                    resizingDmWidth ? 'cursor-grabbing' : 'cursor-grab'
                  )}
                  style={{ left: effectiveDmWidth, width: DM_RAIL_WIDTH }}
                  onPointerDown={onDmRailPointerDown}
                  onPointerMove={onDmRailPointerMove}
                  onPointerUp={onDmRailPointerUp}
                  onPointerCancel={onDmRailPointerUp}
                >
                  <div className={cn(
                    'absolute inset-0 rounded-lg transition-colors',
                    resizingDmWidth ? 'bg-[hsl(var(--theme-background)/0.2)]' : 'group-hover:bg-[hsl(var(--theme-background)/0.2)]'
                  )}
                  />
                  <div className={cn(
                    'absolute top-[9px] bottom-[9px] left-1/2 -ml-px border-l-2 border-dashed transition-colors',
                    resizingDmWidth ? 'border-foreground/40' : 'border-transparent group-hover:border-foreground/40'
                  )}
                  />
                  <div className={cn(
                    'relative w-0 h-0 border-x-4 border-x-transparent border-t-[6px] transition-colors',
                    resizingDmWidth ? 'border-t-foreground/60' : 'border-t-foreground/30 group-hover:border-t-foreground/60'
                  )}
                  />
                  <div className={cn(
                    'relative w-0 h-0 border-x-4 border-x-transparent border-b-[6px] transition-colors',
                    resizingDmWidth ? 'border-b-foreground/60' : 'border-b-foreground/30 group-hover:border-b-foreground/60'
                  )}
                  />
                </div>
              )}
              <MessageSection
                socket={socket}
                currentUser={currentUser}
                fetchMessages={fetchMessagesAction}
                messages={messages}
                hasMore={hasMoreMessages}
                pending={messagesPending}
                updateThreadReadTime={updateThreadReadTimeAction}
                messageThread={messageThread}
              />
              <PeopleTyping postId={messageThreadId} className='w-full max-w-[var(--dm-stream-width,9999px)] pl-16 py-1 flex-shrink-0 px-3' />
            </div>
            <div className='flex-shrink-0 pb-3 w-full'>
              {messageThread?.isMuted && <MutedThreadNotice />}
              <MessageForm
                disabled={!messageThreadId && participants.length === 0}
                onSubmit={sendMessage}
                onFocus={() => setPeopleSelectorOpen(false)}
                currentUser={currentUser}
                ref={formRef}
                updateMessageText={updateMessageTextAction}
                messageText={messageText}
                sendIsTyping={status => isRealThread && sendIsTyping(messageThreadId, status)}
                pending={messageCreatePending}
              />
            </div>
          </div>
          {socket && isRealThread && <SocketSubscriber type='post' id={messageThreadId} />}
        </div>)}
    </div>
  )
}

export default Messages
