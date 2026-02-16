import React, { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet'
import { get } from 'lodash/fp'
import { TextHelpers } from '@hylo/shared'
import PeopleSelector from './PeopleSelector'
import Header from './Header'
import MessageSection from './MessageSection'
import MessageForm from './MessageForm'
import PeopleTyping from 'components/PeopleTyping'
import SocketSubscriber from 'components/SocketSubscriber'
import { sendIsTyping } from 'client/websockets'

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
  removeParticipant,
  createMessageAction,
  findOrCreateThreadAction,
  goToThreadAction
}) => {
  const [viewportHeight, setViewportHeight] = useState(0)

  // Recreate sendMessage logic for mobile with proper actions
  const sendMessageMobile = async () => {
    if (!messageText || messageCreatePending) return false
    if (forNewThread) {
      const participantIds = participants.map(p => p.id)
      if (participantIds.length === 0) return false
      const createThreadResponse = await findOrCreateThreadAction(participantIds)
      const newMessageThreadId = get('payload.data.findOrCreateThread.id', createThreadResponse) ||
        get('data.findOrCreateThread.id', createThreadResponse)
      await createMessageAction(newMessageThreadId, TextHelpers.markdown(messageText), true)
      setParticipants([])
      goToThreadAction(newMessageThreadId)
    } else {
      await createMessageAction(messageThreadId, TextHelpers.markdown(messageText))
      focusForm()
    }
    return false
  }

  // Track viewport height for keyboard handling
  useEffect(() => {
    const updateViewport = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height)
      } else {
        setViewportHeight(window.innerHeight)
      }
    }

    updateViewport()

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewport)
      window.visualViewport.addEventListener('scroll', updateViewport)
    }

    window.addEventListener('resize', updateViewport)

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewport)
        window.visualViewport.removeEventListener('scroll', updateViewport)
      }
      window.removeEventListener('resize', updateViewport)
    }
  }, [])

  const header = forNewThread
    ? (
      <div className='flex-shrink-0 bg-midground border-b border-border p-3 space-y-2'>
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
          autoFocus={false}
        />
      </div>
      )
    : (
      <div className='flex-shrink-0 bg-midground border-b border-border px-3 py-3'>
        <Header
          messageThread={messageThread}
          currentUser={currentUser}
          pending={messagesPending}
        />
      </div>
      )

  return (
    <div
      className='flex flex-col w-full fixed inset-0 bg-background'
      style={{ height: viewportHeight > 0 ? `${viewportHeight}px` : '100dvh' }}
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
            <div className='flex-shrink-0 px-3 pb-3 bg-background border-t border-border'>
              <MessageForm
                disabled={!messageThreadId && participants.length === 0}
                onSubmit={sendMessageMobile}
                onFocus={() => setPeopleSelectorOpen(false)}
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
