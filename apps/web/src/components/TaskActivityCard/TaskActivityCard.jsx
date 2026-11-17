import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SquareKanban } from 'lucide-react'
import { postUrl } from '@hylo/navigation'
import RoundImageRow from 'components/RoundImageRow'
import { fetchTaskEvents } from 'store/actions/taskActions'
import summarizeTaskEvents, { eventsFromToday } from './summarizeTaskEvents'

/** Lines shown before "Show more". */
const VISIBLE_LINES = 3

/**
 * "Today in Tasks": one card at the top of a group's stream that collates the day's task
 * activity (completed, added, picked up, moved) so the stream isn't filled by each change.
 * Renders nothing when no task activity has happened today.
 */
export default function TaskActivityCard ({ groupId, routeParams }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [events, setEvents] = useState([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!groupId) return
    let cancelled = false
    setEvents([])
    Promise.resolve(dispatch(fetchTaskEvents(groupId))).then(result => {
      if (!cancelled) setEvents(result?.payload?.data?.group?.taskEvents || [])
    }).catch(() => {})
    return () => { cancelled = true }
  }, [dispatch, groupId])

  const summary = useMemo(() => summarizeTaskEvents(eventsFromToday(events)), [events])
  if (summary.lines.length === 0) return null

  const taskLink = task => (
    <Link key={task.id} to={postUrl(task.id, routeParams)} className='font-bold text-foreground hover:text-selected'>
      {task.title}
    </Link>
  )

  const renderLine = (line, i) => {
    const name = <strong>{line.actor?.name}</strong>
    let content
    switch (line.kind) {
      case 'completed':
        content = <>{name} {t('completed')} {taskLink(line.task)}</>
        break
      case 'added':
        content = line.tasks.length === 1
          ? <>{name} {t('added')} {taskLink(line.tasks[0])}</>
          : <>{name} {t('added {{count}} tasks:', { count: line.tasks.length })} {line.tasks.map((task, j) => <span key={task.id}>{j > 0 && ', '}{taskLink(task)}</span>)}</>
        break
      case 'took':
        content = <>{name} {t('picked up')} {taskLink(line.task)}</>
        break
      case 'assigned':
        content = <>{name} {t('assigned')} {taskLink(line.task)} {line.to ? t('to {{name}}', { name: line.to }) : null}</>
        break
      default:
        content = <>{name} {t('moved')} {taskLink(line.task)} {t('to {{name}}', { name: line.to })}</>
    }
    return <li key={i} className='text-sm text-foreground/80 leading-snug'>{content}</li>
  }

  const lines = expanded ? summary.lines : summary.lines.slice(0, VISIBLE_LINES)
  const hidden = summary.lines.length - lines.length
  const tally = [
    summary.tally.done > 0 && t('{{count}} completed', { count: summary.tally.done }),
    summary.tally.added > 0 && t('{{count}} added', { count: summary.tally.added })
  ].filter(Boolean).join(' · ')

  return (
    <div data-testid='task-activity-card' className='rounded-xl bg-card border border-foreground/10 p-3 sm:p-4 mb-3 flex flex-col gap-2 shadow-sm'>
      <div className='flex items-center gap-2'>
        <span className='inline-flex items-center justify-center w-7 h-7 rounded-md bg-projects/15 text-projects'>
          <SquareKanban className='w-4 h-4' />
        </span>
        <span className='font-bold text-foreground'>{t('Today in Tasks')}</span>
        {tally && <span className='text-xs text-foreground/60'>{tally}</span>}
        <span className='ml-auto'>
          <RoundImageRow imageUrls={summary.people.map(p => p.avatarUrl).filter(Boolean)} cap={5} tiny />
        </span>
      </div>
      <ul className='list-none m-0 p-0 flex flex-col gap-1'>
        {lines.map(renderLine)}
      </ul>
      {(hidden > 0 || expanded) && summary.lines.length > VISIBLE_LINES && (
        <button
          type='button'
          onClick={() => setExpanded(!expanded)}
          className='self-start border-none bg-transparent p-0 text-xs font-bold text-selected cursor-pointer'
        >
          {expanded ? t('Show less') : t('Show {{count}} more', { count: hidden })}
        </button>
      )}
    </div>
  )
}
