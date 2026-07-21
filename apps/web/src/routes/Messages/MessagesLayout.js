import React from 'react'
import { useParams } from 'react-router-dom'
import Loading from 'components/Loading'
import { isPhoneDevice } from 'util/mobile'
import Messages from './Messages'
import ThreadList from './ThreadList'

/**
 * On phones, ThreadList lives in the nav drawer and Messages fills the center column.
 * On tablet/desktop, ThreadList and Messages sit side-by-side in the center column
 * so the thread list never overlays the conversation.
 */
export default function MessagesLayout () {
  const { messageThreadId } = useParams()

  if (isPhoneDevice()) {
    if (!messageThreadId) return <Loading />
    return <Messages />
  }

  return (
    <div className='flex flex-row flex-1 min-h-0 w-full h-full overflow-hidden'>
      <ThreadList />
      <div className='flex flex-col flex-1 min-w-0 min-h-0 h-full'>
        {messageThreadId ? <Messages /> : <Loading />}
      </div>
    </div>
  )
}
