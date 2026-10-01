import React from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { newMessageUrl } from '@hylo/navigation'

/**
 * True when a loaded conversation has no one left but the viewer (everyone else
 * left it, or is blocked). The server refuses replies then, so the composer is
 * replaced by ConversationEndedNotice.
 */
export function isConversationEnded (messageThread, currentUser) {
  const participants = messageThread?.participants || []
  if (!currentUser || participants.length === 0) return false
  return participants.every(person => String(person.id) === String(currentUser.id))
}

/**
 * Shown in place of the composer when no one else is in the conversation.
 */
export default function ConversationEndedNotice () {
  const { t } = useTranslation()

  return (
    <div
      className='mx-auto max-w-[750px] rounded-lg border border-foreground/15 bg-darkening/20 px-3 py-2 text-sm text-foreground/80 flex flex-wrap items-center justify-between gap-2'
      data-testid='conversation-ended-notice'
    >
      <span>{t('conversationEndedNotice')}</span>
      <Link to={newMessageUrl()} className='font-medium text-foreground underline hover:text-accent'>
        {t('Start a new message')}
      </Link>
    </div>
  )
}
