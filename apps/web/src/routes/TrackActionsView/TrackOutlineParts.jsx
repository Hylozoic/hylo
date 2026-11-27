import { Check, ListChecks, Lock, MessageCircle, Paperclip, PenLine, Sparkles } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'

// How an action is completed (posts.completion_action), with the short label shown on its row
const COMPLETION_TYPES = {
  button: { Icon: Check, label: 'Check off' },
  comment: { Icon: MessageCircle, label: 'Comment' },
  reaction: { Icon: Sparkles, label: 'React' },
  selectOne: { Icon: ListChecks, label: 'Choose one' },
  selectMultiple: { Icon: ListChecks, label: 'Choose any' },
  text: { Icon: PenLine, label: 'Write' },
  uploadFile: { Icon: Paperclip, label: 'Upload' }
}

/** Small tag naming how an action is completed, e.g. "Check off" or "Upload". */
export function CompletionTypeTag ({ type }) {
  const { t } = useTranslation()
  const { Icon, label } = COMPLETION_TYPES[type] || COMPLETION_TYPES.button
  return (
    <span className='inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-foreground/10 text-foreground/70 text-[11px] font-semibold whitespace-nowrap shrink-0'>
      <Icon className='w-3 h-3' />
      {t(label)}
    </span>
  )
}

/** Round marker at the start of an action row: done, up next, locked, or not started. */
export function StatusDot ({ done, current, locked, small }) {
  return (
    <span
      className={cn(
        'rounded-full shrink-0 grid place-items-center text-white border',
        small ? 'w-[22px] h-[22px]' : 'w-[26px] h-[26px]',
        done
          ? 'bg-selected border-selected'
          : current
            ? 'bg-focus border-focus'
            : locked
              ? 'border-foreground/20 text-foreground/40'
              : 'border-foreground/40'
      )}
    >
      {done
        ? <Check className={small ? 'w-3 h-3' : 'w-3.5 h-3.5'} strokeWidth={3} />
        : locked
          ? <Lock className={small ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
          : current
            ? <span className='w-2 h-2 rounded-full bg-white' />
            : null}
    </span>
  )
}
