import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { summarizeGroupChat } from 'store/actions/groupAssistant'
import AxlAvatar from './AxlAvatar'

/**
 * "Catch me up" in a chat room (the "Summarize busy chats" ability): Axl summarises the chat
 * since the member's last read message, or the last day. Shown only when the server says this
 * member may ask here (group.assistantForMe.summarize). The summary is not kept.
 */
export default function ChatCatchUp ({ group, sincePostId }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)

  const catchUp = async () => {
    setOpen(true)
    setLoading(true)
    setError(null)
    setSummary(null)
    try {
      const response = await dispatch(summarizeGroupChat(group.id, sincePostId || null))
      const result = response?.payload?.data?.summarizeGroupChat
      if (response?.error || !result) throw response?.payload || new Error()
      setSummary(result)
    } catch (err) {
      setError(err?.message || t('Something went wrong. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type='button'
        onClick={catchUp}
        className='inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border-2 border-foreground/20 text-xs font-semibold text-foreground hover:border-foreground/50'
        data-testid='chat-catch-up'
      >
        <AxlAvatar size={16} />
        {t('Catch me up')}
      </button>
      {open && createPortal(
        <div className='fixed inset-0 z-[1000] flex items-start justify-center bg-darkening/40 p-4 pt-20' onClick={() => setOpen(false)}>
          <div
            className='w-full max-w-lg rounded-xl bg-card border-2 border-foreground/15 p-4 shadow-xl'
            role='dialog'
            aria-label={t('Catch me up')}
            onClick={event => event.stopPropagation()}
            data-testid='chat-catch-up-panel'
          >
            <div className='flex items-center gap-2 mb-2'>
              <AxlAvatar size={24} />
              <h2 className='m-0 flex-1 text-base font-bold text-foreground'>{t('What you missed')}</h2>
              <button type='button' onClick={() => setOpen(false)} aria-label={t('Close')} className='text-foreground/60 hover:text-foreground'><X className='w-4 h-4' /></button>
            </div>
            {loading && <p className='m-0 text-sm text-foreground/70'>{t('Axl is reading the chat...')}</p>}
            {error && <p className='m-0 text-sm text-accent' role='alert'>{error}</p>}
            {summary && (
              <div className='text-sm leading-relaxed text-foreground/85' data-testid='chat-catch-up-summary'>
                <p className='m-0 whitespace-pre-line'>{summary.text || t('Nothing new to catch up on.')}</p>
                {summary.notShared > 0 && (
                  <p className='m-0 mt-2 text-xs text-foreground/60'>{t('Some messages are left out because their authors haven’t agreed to share with Axl.')}</p>
                )}
              </div>
            )}
            <p className='m-0 mt-3 text-[11px] text-foreground/50'>{t('Summarised by Claude, an AI made by Anthropic, from members who agreed to share.')}</p>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
