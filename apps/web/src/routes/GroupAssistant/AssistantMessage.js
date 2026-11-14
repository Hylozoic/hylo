import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { DateTimeHelpers } from '@hylo/shared'
import Avatar from 'components/Avatar'
import { getLocaleFromLocalStorage } from 'util/locale'
import AxlAvatar from './AxlAvatar'

/**
 * One message in the steward thread. A steward's message is plain text; one
 * from Axl can also carry parts (a quoted post, numbered counsel, a list, a
 * draft to post). Parts are structured data checked by the server, never
 * markup, so they are drawn here from their fields.
 */

const cardClass = 'rounded-lg border-2 border-foreground/15 bg-card text-card-foreground'

function QuotedPost ({ part, postUrl }) {
  const { t } = useTranslation()
  const when = part.createdAt ? DateTimeHelpers.humanDate(part.createdAt) : ''
  return (
    <Link
      to={postUrl(part.postId)}
      data-testid='assistant-quoted-post'
      className='block rounded-lg bg-card text-card-foreground border-l-4 border-focus px-3 py-2.5 hover:bg-card/80 no-underline'
    >
      <span className='flex flex-wrap items-baseline gap-x-2 text-xs text-foreground/60 mb-1'>
        <span className='text-sm font-bold text-foreground'>{part.author || t('Someone')}</span>
        <span>
          {[part.space && t('in {{space}}', { space: part.space }), when, part.replies > 0 ? t('{{count}} replies', { count: part.replies }) : t('no replies')].filter(Boolean).join(' · ')}
        </span>
      </span>
      {part.title && <span className='block text-sm font-semibold text-foreground'>{part.title}</span>}
      {part.text && <span className='block text-sm text-foreground/80 line-clamp-4'>{part.text}</span>}
    </Link>
  )
}

function Counsel ({ part }) {
  return (
    <ol className='m-0 p-0 list-none grid gap-2' data-testid='assistant-counsel'>
      {part.steps.map((step, index) => (
        <li key={index} className={`${cardClass} flex gap-2.5 px-3 py-2.5`}>
          <span className='grid place-items-center w-6 h-6 shrink-0 rounded-md bg-accent/20 text-accent text-xs font-extrabold'>{index + 1}</span>
          <span className='min-w-0'>
            <span className='block text-sm font-bold text-foreground'>{step.title}</span>
            {step.line && <span className='block text-sm text-foreground/70'>{step.line}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

function Draft ({ part, onPost }) {
  const { t } = useTranslation()
  const [text, setText] = useState(part.text)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState(null)
  const posted = part.posted
  const where = part.space || t('this group')

  const post = async () => {
    setPosting(true)
    setError(null)
    try {
      await onPost(text)
    } catch (err) {
      setError(err?.message || t('Something went wrong. Please try again.'))
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className={`${cardClass} overflow-hidden`} data-testid='assistant-draft'>
      {part.replyToTitle && !posted && (
        <p className='m-0 px-3 pt-2.5 text-xs text-foreground/60'>{t('Reply to “{{title}}”', { title: part.replyToTitle })}</p>
      )}
      {part.title && <p className='m-0 px-3 pt-2.5 text-sm font-bold text-foreground'>{part.title}</p>}
      {posted
        ? <p className='m-0 px-3 py-2.5 text-sm text-foreground/85 whitespace-pre-wrap'>{part.text}</p>
        : (
          <textarea
            value={text}
            onChange={event => setText(event.target.value)}
            rows={Math.min(12, Math.max(3, Math.ceil(text.length / 70)))}
            aria-label={t('Draft')}
            className='block w-full bg-transparent border-0 outline-none resize-none px-3 py-2.5 text-sm text-foreground'
          />
          )}
      <div className='flex flex-wrap items-center gap-2 px-3 py-2 border-t-2 border-foreground/10 bg-background/40'>
        <span className='flex-1 min-w-0 text-xs text-foreground/60'>
          {posted
            ? t('Posted in {{space}} by {{name}}', { space: where, name: posted.byName || t('a steward') })
            : t('Draft · posts as you in {{space}}', { space: where })}
        </span>
        {error && <span className='text-xs text-accent' role='alert'>{error}</span>}
        {posted
          ? <span className='inline-flex items-center gap-1 text-xs font-bold text-selected'><Check className='w-3.5 h-3.5' strokeWidth={2.5} />{t('Posted')}</span>
          : (
            <button
              type='button'
              onClick={post}
              disabled={posting || !text.trim()}
              data-testid='assistant-post-draft'
              className='h-8 px-3 rounded-md bg-selected text-white text-xs font-bold disabled:opacity-50'
            >
              {posting ? t('Posting...') : t('Post it')}
            </button>
            )}
      </div>
    </div>
  )
}

export default function AssistantMessage ({ message, currentUserId, postUrl, onPostDraft }) {
  const { t } = useTranslation()
  const isAxl = message.authorType === 'axl'
  const mine = !isAxl && String(message.author?.id) === String(currentUserId)
  const name = isAxl ? 'Axl' : (message.author?.name || t('A steward'))
  const time = message.createdAt
    ? new Date(message.createdAt).toLocaleString(getLocaleFromLocalStorage(), { weekday: 'short', hour: 'numeric', minute: '2-digit' })
    : ''

  return (
    <div className='flex gap-3 py-2.5' data-testid={isAxl ? 'assistant-message-axl' : 'assistant-message-steward'}>
      {isAxl ? <AxlAvatar size={34} /> : <Avatar avatarUrl={message.author?.avatarUrl} small />}
      <div className='flex-1 min-w-0 max-w-[680px]'>
        <div className='flex flex-wrap items-baseline gap-x-2 mb-0.5'>
          <span className={`text-sm font-bold ${isAxl ? 'text-accent' : 'text-foreground'}`}>{mine ? t('{{name}} (you)', { name }) : name}</span>
          {isAxl && <span className='text-[10.5px] font-bold text-foreground/60 bg-foreground/10 px-1.5 py-px rounded'>{t('Assistant')}</span>}
          <span className='text-xs text-foreground/50'>{time}</span>
        </div>
        {message.text && <p className='m-0 text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap break-words'>{message.text}</p>}
        {(message.parts || []).length > 0 && (
          <div className='grid gap-2 mt-2.5'>
            {message.parts.map((part, index) => {
              switch (part.type) {
                case 'quotedPost':
                  return <QuotedPost key={index} part={part} postUrl={postUrl} />
                case 'counsel':
                  return <Counsel key={index} part={part} />
                case 'bullets':
                  return (
                    <ul key={index} className='m-0 pl-5 list-disc text-sm leading-relaxed text-foreground/80' data-testid='assistant-bullets'>
                      {part.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
                    </ul>
                  )
                case 'draft':
                  return <Draft key={`${index}-${part.posted ? 'posted' : 'draft'}`} part={part} onPost={text => onPostDraft(message, index, text)} />
                default:
                  return null
              }
            })}
          </div>
        )}
      </div>
    </div>
  )
}
