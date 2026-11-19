import { Check, ChevronRight, Lock } from 'lucide-react'
import { DateTime } from 'luxon'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from 'components/ui/button'
import { cn } from 'util/index'

import { CompletionTypeTag, StatusDot } from './TrackOutlineParts'
import { currentAction, moduleLock, moduleNumber, outlineProgress } from './trackOutline'

/** One action in the participant outline. Clicking it opens the action. */
function ActionRow ({ post, current, locked, nested, onOpen }) {
  const { t } = useTranslation()
  const done = !!post.completedAt
  return (
    <button
      type='button'
      disabled={locked}
      onClick={() => onOpen(post)}
      data-testid='track-action-row'
      className={cn(
        'w-full flex items-center gap-3 text-left border transition-colors',
        nested ? 'rounded-lg py-2.5 pl-4 pr-3.5 border-transparent' : 'rounded-xl py-3 px-4 bg-card border-foreground/10',
        !locked && (nested ? 'hover:bg-foreground/5' : 'hover:border-foreground/30'),
        current && 'bg-focus/15 border-focus/70 hover:border-focus',
        locked && 'opacity-55 cursor-default'
      )}
    >
      <StatusDot done={done} current={current} locked={locked} small={nested} />
      <span className='flex-1 min-w-0'>
        <span className={cn('block font-semibold leading-snug', nested ? 'text-sm' : 'text-[15px]', done ? 'text-foreground/60' : 'text-foreground')}>
          {post.title}
        </span>
        {current && <span className='block text-xs font-semibold text-foreground/80 mt-0.5'>{t('Up next')}</span>}
      </span>
      <CompletionTypeTag type={post.completionAction} />
    </button>
  )
}

/** A module in the participant outline: a header with its progress, and its actions when open. */
function ModuleBlock ({ items, item, track, currentPostId, open, onToggle, onOpen }) {
  const { t, i18n } = useTranslation()
  const number = moduleNumber(items, item.id)
  const total = item.posts.length
  const done = item.posts.filter(post => !!post.completedAt).length
  const lock = moduleLock(items, item)
  const complete = total > 0 && done === total
  const hasCurrent = item.posts.some(post => post.id === currentPostId)

  const lockLabel = !lock.locked
    ? null
    : lock.reason === 'date'
      ? t('Opens {{date}}', { date: DateTime.fromJSDate(lock.opensAt).setLocale(i18n.language).toLocaleString({ weekday: 'short', month: 'short', day: 'numeric' }) })
      : t('Opens after {{moduleDescriptor}} {{number}}', { moduleDescriptor: track.moduleDescriptor, number: lock.previousNumber })

  return (
    <div
      data-testid='track-module'
      className={cn('rounded-xl border overflow-hidden', hasCurrent ? 'bg-focus/10 border-focus/40' : 'bg-card border-foreground/10')}
    >
      <button type='button' onClick={onToggle} aria-expanded={open} className='w-full flex items-center gap-3 px-4 py-3.5 text-left'>
        <span
          className={cn(
            'w-10 h-10 rounded-xl shrink-0 grid place-items-center text-[15px] font-extrabold border',
            complete
              ? 'bg-selected/25 border-selected/50 text-selected'
              : lock.locked
                ? 'bg-foreground/5 border-foreground/15 text-foreground/50'
                : 'bg-focus/25 border-focus/50 text-foreground'
          )}
        >
          {complete ? <Check className='w-[18px] h-[18px]' strokeWidth={2.6} /> : lock.locked ? <Lock className='w-4 h-4' /> : number}
        </span>
        <span className='flex-1 min-w-0'>
          <span className='block text-xs font-semibold text-foreground/60'>
            {track.moduleDescriptor} {number}{lockLabel ? ` · ${lockLabel}` : ''}
          </span>
          <span className={cn('block text-base font-bold tracking-tight mt-px', lock.locked ? 'text-foreground/70' : 'text-foreground')}>
            {item.module.title}
          </span>
        </span>
        <span className='flex items-center gap-2.5 shrink-0'>
          {!lock.locked && total > 0 && (
            <span className='flex items-center gap-2'>
              <span className='hidden xs:block w-16 h-[5px] rounded-full bg-foreground/15 overflow-hidden'>
                <span className={cn('block h-full', complete ? 'bg-selected' : 'bg-focus')} style={{ width: `${(done / total) * 100}%` }} />
              </span>
              <span className='text-xs font-semibold text-foreground/60 min-w-7'>{done}/{total}</span>
            </span>
          )}
          <ChevronRight className={cn('w-4 h-4 text-foreground/60 transition-transform', open && 'rotate-90')} />
        </span>
      </button>
      {open && (
        <div className='px-2.5 pb-2.5 flex flex-col gap-0.5'>
          {item.module.description && (
            <p className='text-[13px] text-foreground/70 leading-normal pl-16 pr-2 pb-2 -mt-1 mb-0'>{item.module.description}</p>
          )}
          {item.posts.map(post => (
            <ActionRow key={post.id} post={post} nested current={post.id === currentPostId} locked={lock.locked} onOpen={onOpen} />
          ))}
          {total === 0 && (
            <p className='text-[13px] text-foreground/50 px-4 py-1.5 mb-0'>
              {t('No {{actionDescriptorPlural}} yet.', { actionDescriptorPlural: track.actionDescriptorPlural })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The participant view of a track: a summary card with overall progress, then
 * the outline of modules and actions. Nothing is marked "up next" until the
 * person has started the track.
 */
export default function TrackOutline ({ items, track, group, canEdit, onOpenPost, onStartEditing, onEnroll }) {
  const { t } = useTranslation()
  const progress = outlineProgress(items)
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  const finished = progress.total > 0 && progress.done === progress.total
  const moduleCount = items.filter(item => item.kind === 'module').length
  const enrolled = track.isEnrolled !== false
  const next = currentAction(items)
  const currentPostId = enrolled && next ? next.post.id : null
  const nextModuleId = next?.moduleItem?.id

  // The module holding the next action starts expanded, once the outline has loaded
  const [expanded, setExpanded] = useState(() => new Set(nextModuleId ? [nextModuleId] : []))
  const didAutoExpand = useRef(!!nextModuleId)
  useEffect(() => {
    if (didAutoExpand.current || !nextModuleId) return
    didAutoExpand.current = true
    setExpanded(current => new Set(current).add(nextModuleId))
  }, [nextModuleId])

  const toggle = moduleId => setExpanded(current => {
    const updated = new Set(current)
    updated.has(moduleId) ? updated.delete(moduleId) : updated.add(moduleId)
    return updated
  })

  const openPost = post => onOpenPost(post)
  const continueTrack = () => {
    if (!next) return
    if (nextModuleId) setExpanded(current => new Set(current).add(nextModuleId))
    openPost(next.post)
  }

  const role = track.completionRole

  return (
    <>
      <div className='rounded-xl bg-card border border-foreground/10 px-5 py-[18px] mb-4' data-testid='track-summary'>
        {group.description && <p className='text-sm text-foreground/80 leading-relaxed whitespace-pre-line mb-0'>{group.description}</p>}
        <div className='flex items-center gap-x-3.5 gap-y-1 flex-wrap mt-3 text-[13px] text-foreground/60'>
          {moduleCount > 0 && <span>{moduleCount} {moduleCount === 1 ? track.moduleDescriptor : track.moduleDescriptorPlural}</span>}
          <span>{progress.total} {progress.total === 1 ? track.actionDescriptor : track.actionDescriptorPlural}</span>
          {track.numPeopleEnrolled != null && <span>{t('{{count}} enrolled', { count: track.numPeopleEnrolled })}</span>}
          {role?.name && <span>{t('Finish to earn {{role}}', { role: `${role.emoji || ''} ${role.name}`.trim() })}</span>}
        </div>
        {enrolled
          ? (
            <div className='flex items-center gap-3.5 mt-4'>
              <div className='flex-1 h-2 rounded-full bg-foreground/10 overflow-hidden' role='progressbar' aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                <div className={cn('h-full transition-all duration-300', finished ? 'bg-selected' : 'bg-focus')} style={{ width: `${percent}%` }} />
              </div>
              <span className='text-[13px] font-bold whitespace-nowrap'>{t('{{done}} of {{total}} done', progress)}</span>
              {next && <Button size='sm' className='bg-focus text-white hover:bg-focus/90 border-0' onClick={continueTrack}>{t('Continue')}</Button>}
              {finished && <span className='text-[13px] font-bold text-selected whitespace-nowrap'>{role?.emoji} {t('Complete')}</span>}
            </div>
            )
          : (
            <div className='mt-4'>
              <Button className='bg-selected text-white hover:bg-selected/90 border-0' onClick={onEnroll}>{t('Start this track')}</Button>
            </div>
            )}
      </div>

      {items.length === 0 && (
        <div className='rounded-xl border border-dashed border-foreground/30 px-5 py-7 text-center'>
          <div className='text-[15px] font-bold mb-1.5'>{t('This track is empty')}</div>
          <p className={cn('text-[13px] text-foreground/60 leading-normal', canEdit ? 'mb-3.5' : 'mb-0')}>
            {t('Add {{actionDescriptorPlural}} on their own, or group them into {{moduleDescriptorPlural}}.', {
              actionDescriptorPlural: track.actionDescriptorPlural,
              moduleDescriptorPlural: track.moduleDescriptorPlural
            })}
          </p>
          {canEdit && <Button variant='secondary' onClick={onStartEditing}>{t('Start building')}</Button>}
        </div>
      )}

      <div className='flex flex-col gap-2.5'>
        {items.map(item => item.kind === 'module'
          ? (
            <ModuleBlock
              key={`module-${item.id}`}
              items={items}
              item={item}
              track={track}
              currentPostId={currentPostId}
              open={expanded.has(item.id)}
              onToggle={() => toggle(item.id)}
              onOpen={openPost}
            />
            )
          : <ActionRow key={`action-${item.id}`} post={item.post} current={item.post.id === currentPostId} onOpen={openPost} />)}
      </div>
    </>
  )
}
