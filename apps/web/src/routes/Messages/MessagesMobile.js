import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Helmet } from 'react-helmet'
import { useDispatch } from 'react-redux'
import { ChevronLeft } from 'lucide-react'
import PeopleSelector from './PeopleSelector'
import Header from './Header'
import MessageSection from './MessageSection'
import MessageForm from './MessageForm'
import PeopleTyping from 'components/PeopleTyping'
import SocketSubscriber from 'components/SocketSubscriber'
import { sendIsTyping } from 'client/websockets'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import { canAddThreadParticipant } from './messageThreadLimits'

export const NEW_THREAD_ID = 'new'

const MessagesMobile = ({
  messageThreadId,
  messageThread,
  messages,
  hasMoreMessages,
  messagesPending,
  messageText,
  messageCreatePending,
  currentUser,
  socket,
  forNewThread,
  setForNewThread,
  participants,
  setParticipants,
  peopleSelectorOpen,
  setPeopleSelectorOpen,
  contacts,
  formRef,
  focusForm,
  sendMessage,
  fetchMessagesAction,
  updateThreadReadTimeAction,
  fetchPeopleAction,
  fetchRecentContactsAction,
  setContactsSearchAction,
  updateMessageTextAction,
  addParticipant,
  removeParticipant
}) => {
  const dispatch = useDispatch()
  const peopleSelectorInputRef = useRef(null)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [viewportOffset, setViewportOffset] = useState(0)

  /** Scrolls #message-list to the bottom; repeated passes catch layout after keyboard / flex resize (esp. iOS Safari). */
  const scheduleScrollMessageListToBottom = useCallback(() => {
    const scroll = () => {
      const messageList = document.querySelector('#message-list')
      if (!messageList) return
      messageList.scrollTop = messageList.scrollHeight
    }
    scroll()
    window.requestAnimationFrame(scroll)
    window.requestAnimationFrame(() => window.requestAnimationFrame(scroll))
    setTimeout(scroll, 50)
    setTimeout(scroll, 200)
  }, [])

  // When the on-screen keyboard opens or closes, the message list's client height
  // changes but scrollTop is not adjusted — pin to the last message again.
  useEffect(() => {
    if (!messageThreadId || messageThreadId === 'new') return
    scheduleScrollMessageListToBottom()
  }, [messageThreadId, viewportHeight, viewportOffset, scheduleScrollMessageListToBottom])

  // Track viewport height and offset for keyboard handling.
  // When the user taps the input (vs programmatic focus with preventScroll: true),
  // Safari scrolls the visual viewport to center the focused element, changing
  // visualViewport.offsetTop. We track this offset so the fixed container follows
  // the visual viewport and sits flush against the keyboard with no gap.
  useEffect(() => {
    const updateViewportSize = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height)
      } else {
        setViewportHeight(window.innerHeight)
      }
    }

    const updateViewportOffset = () => {
      if (window.visualViewport) {
        setViewportOffset(window.visualViewport.offsetTop)
      }
    }

    updateViewportSize()
    updateViewportOffset()

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportSize)
      // Track scroll separately — when Safari scrolls the visual viewport to
      // center a focused input, we need to reposition the container to match
      window.visualViewport.addEventListener('scroll', updateViewportOffset)
    }

    window.addEventListener('resize', updateViewportSize)

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewportSize)
        window.visualViewport.removeEventListener('scroll', updateViewportOffset)
      }
      window.removeEventListener('resize', updateViewportSize)
    }
  }, [])

  // Auto-focus: PeopleSelector for new threads, MessageForm for existing threads
  // Only run once when switching between new/existing thread, not on every render
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (forNewThread) {
        // Focus the people selector input for new conversations
        if (peopleSelectorInputRef.current) {
          peopleSelectorInputRef.current.focus()
        }
      } else if (messageThreadId && messageThreadId !== 'new') {
        // Focus the message form for existing threads
        focusForm()
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [forNewThread, messageThreadId]) // Only depend on forNewThread and messageThreadId, not focusForm

  const handleBack = () => {
    dispatch(toggleNavMenu())
  }

  const header = forNewThread
    ? (
      <div className='flex-shrink-0 bg-midground border-b border-border'>
        <div className='flex items-center p-3'>
          <button
            onClick={handleBack}
            className='p-2 -ml-1 mr-2 cursor-pointer'
            aria-label='Back to messages'
          >
            <ChevronLeft className='w-6 h-6' />
          </button>
        </div>
        <div className='px-3 pb-3 space-y-2'>
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
            autoFocus
            inputRef={peopleSelectorInputRef}
            maxParticipantsReached={!canAddThreadParticipant(participants, currentUser?.id)}
          />
        </div>
      </div>
      )
    : (
      <div className='flex-shrink-0 bg-midground border-b border-border'>
        <div className='flex items-center px-3 py-2'>
          <button
            onClick={handleBack}
            className='p-2 -ml-1 mr-2 cursor-pointer'
            aria-label='Back to messages'
          >
            <ChevronLeft className='w-6 h-6' />
          </button>
          <div className='flex-1'>
            <Header
              messageThread={messageThread}
              currentUser={currentUser}
              threadId={messageThreadId}
            />
          </div>
        </div>
      </div>
      )

  return (
    <div
      className='flex flex-col w-full fixed left-0 right-0 bg-background'
      style={{
        height: viewportHeight > 0 ? `${viewportHeight}px` : '100dvh',
        top: `${viewportOffset}px`
      }}
    >
      <Helmet>
        <title>Messages | Hylo</title>
      </Helmet>
      {messageThreadId && (
        <>
          {header}
          <div className='flex flex-col flex-1 min-h-0 overflow-hidden relative'>
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
            <PeopleTyping className='w-full mx-auto max-w-[750px] pl-16 py-1 flex-shrink-0 px-3' />
            <div className='flex-shrink-0 px-3 pb-3 bg-background border-t border-border' style={{ pointerEvents: 'auto' }}>
              <MessageForm
                disabled={forNewThread && participants.length === 0}
                onSubmit={sendMessage}
                onFocus={() => {
                  setPeopleSelectorOpen(false)
                  scheduleScrollMessageListToBottom()
                }}
                currentUser={currentUser}
                ref={formRef}
                updateMessageText={updateMessageTextAction}
                messageText={messageText}
                sendIsTyping={(status) => sendIsTyping(messageThreadId, status)}
                pending={messageCreatePending}
              />
            </div>
          </div>
          {socket && messageThreadId && messageThreadId !== 'new' && <SocketSubscriber type='post' id={messageThreadId} />}
        </>
      )}
    </div>
  )
}

export default MessagesMobile
