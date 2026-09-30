import { ArrowUp } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

// The feed sort decides which time says whether a post is new
const TIME_FIELD_BY_SORT = {
  created: 'createdAt',
  updated: 'updatedAt'
}

/**
 * Where the "New since your last visit" divider goes in a newest-first feed:
 * the index of the first post from before the last visit, or null when there
 * is no boundary to show (no baseline, a sort that isn't by time, nothing
 * new, or nothing older loaded yet). Posts without the time (such as chat
 * activity rows) don't decide it.
 */
export function newSinceDividerIndex (posts, baseline, sortBy) {
  const field = TIME_FIELD_BY_SORT[sortBy]
  if (!field || !baseline || !posts?.length) return null
  const since = new Date(baseline).getTime()
  if (!since) return null
  let sawNew = false
  for (let index = 0; index < posts.length; index++) {
    const time = posts[index]?.[field] ? new Date(posts[index][field]).getTime() : NaN
    if (Number.isNaN(time)) continue
    if (time > since) {
      sawNew = true
    } else {
      return sawNew ? index : null
    }
  }
  return null
}

/** The line between posts new since the last visit (above) and older ones. */
export default function NewSinceDivider () {
  const { t } = useTranslation()
  return (
    <div className='flex items-center gap-3 my-3 px-1 text-xs font-semibold uppercase tracking-wide text-foreground-muted' role='separator' aria-label={t('New since your last visit')} data-testid='new-since-divider'>
      <span className='h-px flex-1 bg-foreground/20' />
      <span className='inline-flex items-center gap-1'>
        <ArrowUp className='w-3.5 h-3.5' aria-hidden='true' />
        {t('New since your last visit')}
      </span>
      <span className='h-px flex-1 bg-foreground/20' />
    </div>
  )
}
