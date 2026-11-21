import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CaseSensitive, SendHorizontal } from 'lucide-react'
import Icon from 'components/Icon'
import { cn } from 'util/index'
import { appThemeCssVars, groupThemeCssVars } from 'util/groupTheme'
import { defaultTheme } from '../../../themes'

/**
 * Sample post, chat and event drawn with a draft group theme, so stewards can
 * judge colors, corners, borders and fonts on the kinds of things members see.
 * The samples are static: they use the same theme tokens as the real
 * components but hold no real data.
 */

export const PREVIEW_SAMPLES = ['post', 'chat', 'event']

const SAMPLE_LABELS = { post: 'Post', chat: 'Chat', event: 'Event' }

function SampleAvatar ({ name, className }) {
  return (
    <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-bold', className)}>
      {name.slice(0, 1)}
    </span>
  )
}

function SampleReply ({ name, time, children }) {
  return (
    <div className='flex gap-2'>
      <SampleAvatar name={name} className='h-6 w-6' />
      <div className='min-w-0'>
        <span className='text-sm font-bold'>{name}</span>
        <span className='text-xs text-foreground/50 pl-2'>{time}</span>
        <p className='text-sm m-0'>{children}</p>
      </div>
    </div>
  )
}

// Mirrors the comment box (routes/PostDetail/Comments/CommentForm)
function SampleComposer ({ placeholder }) {
  return (
    <div className='flex items-center bg-input rounded-lg p-2 border-2 border-transparent'>
      <SampleAvatar name='Maya' className='h-6 w-6' />
      <span className='flex-1 min-w-0 px-2 text-sm text-foreground/50 truncate'>{placeholder}</span>
      <div className='flex items-center gap-2'>
        <CaseSensitive className='w-5 h-5 text-foreground/50' />
        <Icon name='AddImage' className='text-foreground/50' />
        <span className='inline-flex h-9 w-9 items-center justify-center rounded-md bg-selected text-foreground'>
          <SendHorizontal size={18} color='white' />
        </span>
      </div>
    </div>
  )
}

function PostSample () {
  const { t } = useTranslation()
  return (
    <div className='rounded-xl border-2 border-foreground/20 bg-card text-card-foreground p-3 shadow-sm flex flex-col gap-3'>
      <div className='flex items-center gap-2'>
        <SampleAvatar name='Maya' />
        <span className='font-bold text-sm'>Maya</span>
        <span className='flex items-center border-2 border-foreground/20 rounded text-xs px-1 py-0.5 text-foreground/70'>{t('Discussion')}</span>
        <span className='text-xs text-foreground/50 ml-auto'>9:12</span>
      </div>
      <div>
        <h2 className='font-bold text-lg m-0 mb-1'>{t('Community garden workday')}</h2>
        <p className='text-sm m-0'>{t('We are getting the beds ready for spring. Bring gloves and a friend!')}</p>
      </div>
      <div className='flex flex-wrap items-center gap-2 text-xs'>
        <span className='rounded-md border-2 border-foreground/20 px-2 py-0.5'>👍 4</span>
        <span className='rounded-md border-2 border-selected bg-selected/20 px-2 py-0.5'>🌱 2</span>
      </div>
      <div className='border-t-2 border-foreground/10 pt-3 flex flex-col gap-2'>
        <SampleReply name='Sam' time='9:20'>{t('I can bring extra shovels.')}</SampleReply>
        <SampleReply name='Priya' time='9:31'>{t('Count me in!')}</SampleReply>
      </div>
      <SampleComposer placeholder={t('Add a comment...')} />
    </div>
  )
}

function ChatMessage ({ name, time, children, highlighted }) {
  return (
    <div className={cn('flex gap-2 rounded-lg px-2 py-1', highlighted && 'bg-selected/20')}>
      <SampleAvatar name={name} />
      <div className='min-w-0'>
        <span className='text-sm font-bold'>{name}</span>
        <span className='text-xs text-foreground/50 pl-2'>{time}</span>
        <p className='text-sm m-0'>{children}</p>
      </div>
    </div>
  )
}

function ChatSample () {
  const { t } = useTranslation()
  return (
    <div className='rounded-xl bg-midground text-foreground p-3 flex flex-col gap-2'>
      <h3 className='font-bold text-base m-0 border-b-2 border-foreground/10 pb-2'>#general</h3>
      <ChatMessage name='Sam' time='8:02'>{t('Good morning everyone!')}</ChatMessage>
      <ChatMessage name='Priya' time='8:05'>
        {t('Is the meeting still on for today?')} <span className='text-accent font-bold'>@Maya</span>
      </ChatMessage>
      <ChatMessage name='Maya' time='8:06' highlighted>{t('Yes, see you at noon.')}</ChatMessage>
      <SampleComposer placeholder={t('Write a message...')} />
    </div>
  )
}

function EventSample () {
  const { t } = useTranslation()
  return (
    <div className='rounded-xl border-2 border-foreground/20 bg-card text-card-foreground p-3 shadow-sm flex flex-col gap-3'>
      <div className='flex items-start gap-3'>
        <div className='flex flex-col items-center rounded-lg bg-events/20 border-2 border-events px-3 py-1'>
          <span className='text-xs font-bold uppercase'>MAY</span>
          <span className='text-xl font-bold leading-none'>17</span>
        </div>
        <div className='min-w-0'>
          <h2 className='font-bold text-lg m-0'>{t('Spring potluck')}</h2>
          <p className='text-sm text-muted-foreground m-0'>{t('Saturday at noon')} · {t('Community hall')}</p>
        </div>
      </div>
      <p className='text-sm m-0'>{t('Bring a dish to share and meet your neighbors.')}</p>
      <div className='flex flex-wrap items-center gap-2 text-sm'>
        <span className='rounded-md border-2 border-selected bg-selected/20 px-3 py-1 font-bold'>{t('Going')}</span>
        <span className='rounded-md border-2 border-foreground/20 px-3 py-1'>{t('Interested')}</span>
        <span className='rounded-md border-2 border-foreground/20 px-3 py-1'>{t('Not Going')}</span>
      </div>
      <div className='flex items-center'>
        <SampleAvatar name='Maya' className='border-2 border-card' />
        <SampleAvatar name='Sam' className='border-2 border-card -ml-2' />
        <SampleAvatar name='Priya' className='border-2 border-card -ml-2' />
        <span className='text-xs text-muted-foreground pl-2'>+12</span>
      </div>
    </div>
  )
}

const SAMPLE_COMPONENTS = { post: PostSample, chat: ChatSample, event: EventSample }

export default function GroupThemePreview ({ draft, scheme }) {
  const { t } = useTranslation()
  const [sample, setSample] = useState(PREVIEW_SAMPLES[0])
  const style = useMemo(
    () => groupThemeCssVars(draft, scheme) || appThemeCssVars(defaultTheme, scheme),
    [draft, scheme]
  )
  const Sample = SAMPLE_COMPONENTS[sample]

  return (
    <div>
      <div className='inline-flex rounded-lg border-2 border-foreground/20 p-0.5 mb-2' role='group' aria-label={t('Preview')}>
        {PREVIEW_SAMPLES.map(value => (
          <button
            key={value}
            type='button'
            aria-pressed={sample === value}
            data-testid={`group-theme-preview-sample-${value}`}
            onClick={() => setSample(value)}
            className={cn('px-3 py-0.5 rounded-md text-sm', sample === value ? 'bg-selected text-foreground' : 'hover:bg-muted')}
          >
            {t(SAMPLE_LABELS[value])}
          </button>
        ))}
      </div>
      <div style={style} className='rounded-lg border-2 border-foreground/10 bg-background text-foreground p-4 flex flex-col gap-3' data-testid='group-theme-preview-panel'>
        <Sample />
        <div className='flex flex-wrap items-center gap-2'>
          <span className='rounded-md bg-primary text-primary-foreground px-3 py-1 text-sm border border-foreground/20'>{t('Primary button')}</span>
          <span className='rounded-md bg-accent text-accent-foreground px-3 py-1 text-sm'>{t('Accent')}</span>
          <span className='rounded-md bg-selected text-foreground px-3 py-1 text-sm'>{t('Selected')}</span>
          <span className='rounded-md bg-midground text-foreground px-3 py-1 text-sm border border-border'>{t('Menu')}</span>
        </div>
      </div>
    </div>
  )
}
