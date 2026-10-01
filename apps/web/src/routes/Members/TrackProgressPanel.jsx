import { ChevronDown, ChevronRight, MessageCircle } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { newMessageUrl } from '@hylo/navigation'
import Button from 'components/ui/button'
import Loading from 'components/Loading'
import RoundImage from 'components/RoundImage'
import { MAX_MESSAGE_THREAD_PARTICIPANTS } from 'routes/Messages/messageThreadLimits'
import { fetchTrackLearnerProgress } from 'store/actions/trackActions'
import getMe from 'store/selectors/getMe'
import { cn } from 'util/index'
import { formatLocalizedDate } from 'util/dateFormat'
import { messageRecipients, progressFromCounts } from 'util/trackProgress'

const FILTERS = { NOT_FINISHED: 'notFinished', EVERYONE: 'everyone' }

/**
 * For a track's stewards (D63): each learner's progress (N of M, their last action),
 * a "Not finished" filter, and a group message to the people it shows.
 */
export default function TrackProgressPanel ({ trackId }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const me = useSelector(getMe)
  const [open, setOpen] = useState(true)
  const [filter, setFilter] = useState(FILTERS.NOT_FINISHED)
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!trackId || !open) return
    let cancelled = false
    setFailed(false)
    Promise.resolve(dispatch(fetchTrackLearnerProgress(trackId, { completed: filter === FILTERS.NOT_FINISHED ? false : null })))
      .then(result => {
        if (cancelled) return
        const track = result?.payload?.data?.track
        if (!track) throw new Error('no track')
        setData({ filter, total: track.enrolledUsers?.total || 0, numActions: track.numActions || 0, learners: track.enrolledUsers?.items || [] })
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [dispatch, trackId, filter, open])

  const loaded = data && data.filter === filter
  const learners = loaded ? data.learners : []
  const recipients = messageRecipients(learners, me?.id)
  const truncated = recipients.length < learners.filter(learner => String(learner.id) !== String(me?.id)).length

  const messageLearners = useCallback(() => {
    if (recipients.length === 0) return
    navigate(`${newMessageUrl()}?participants=${recipients.map(person => person.id).join(',')}`)
  }, [navigate, recipients])

  return (
    <section className='rounded-xl bg-card/50 border-2 border-foreground/10 p-3 flex flex-col gap-2' data-testid='track-progress-panel'>
      <div className='flex flex-row flex-wrap items-center justify-between gap-2'>
        <button
          type='button'
          onClick={() => setOpen(value => !value)}
          aria-expanded={open}
          className='flex flex-row items-center gap-1 text-base font-bold text-foreground'
        >
          {open ? <ChevronDown className='w-4 h-4' /> : <ChevronRight className='w-4 h-4' />}
          {t('Learner progress')}
        </button>
        {open && (
          <div className='flex items-center rounded-lg border-2 border-foreground/20 overflow-hidden text-xs' role='group' aria-label={t('Learner progress')}>
            {[[FILTERS.NOT_FINISHED, t('Not finished')], [FILTERS.EVERYONE, t('Everyone')]].map(([value, label]) => (
              <button
                key={value}
                type='button'
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={cn('px-2.5 py-1 transition-colors', filter === value ? 'bg-selected text-foreground' : 'text-foreground-muted hover:text-foreground hover:bg-foreground/5')}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {open && failed && (
        <p className='text-sm text-foreground-muted m-0'>{t('There was an error, please try again.')}</p>
      )}
      {open && !failed && !loaded && <Loading />}
      {open && loaded && learners.length === 0 && (
        <p className='text-sm text-foreground-muted m-0'>
          {filter === FILTERS.NOT_FINISHED ? t('Everyone enrolled has finished this track.') : t('Nobody has enrolled yet.')}
        </p>
      )}
      {open && loaded && learners.length > 0 && (
        <>
          <ul className='list-none m-0 p-0 flex flex-col max-h-80 overflow-y-auto'>
            {learners.map(learner => (
              <LearnerRow key={learner.id} learner={learner} numActions={data.numActions} />
            ))}
          </ul>
          {data.total > learners.length && (
            <p className='text-xs text-foreground-muted m-0'>{t('Showing {{count}} of {{total}}', { count: learners.length, total: data.total })}</p>
          )}
          {filter === FILTERS.NOT_FINISHED && recipients.length > 0 && (
            <div className='flex flex-col gap-1'>
              <Button variant='outline' className='self-start' onClick={messageLearners} data-testid='message-not-finished'>
                <MessageCircle className='w-4 h-4' /> {t('Message these learners')}
              </Button>
              {truncated && (
                <p className='text-xs text-foreground-muted m-0'>
                  {t('Group messages are limited to {{count}} people', { count: MAX_MESSAGE_THREAD_PARTICIPANTS })}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function LearnerRow ({ learner, numActions }) {
  const { t } = useTranslation()
  const progress = learner.completedAt
    ? progressFromCounts(numActions, numActions)
    : progressFromCounts(learner.actionsCompleted, numActions)

  return (
    <li className='flex flex-row items-center gap-2 py-1.5 border-b border-foreground/5 last:border-b-0'>
      <RoundImage url={learner.avatarUrl} medium />
      <span className='flex-1 min-w-0 truncate text-sm'>{learner.name}</span>
      <span className='text-xs text-foreground/70 whitespace-nowrap'>
        {t('{{completed}} of {{total}} completed', { completed: progress.completed, total: progress.total })}
      </span>
      <span className='text-xs text-foreground-muted whitespace-nowrap hidden sm:inline'>
        {learner.completedAt
          ? t('Completed {{date}}', { date: formatLocalizedDate(learner.completedAt, { style: 'short' }) })
          : learner.lastActionAt
            ? t('Last action {{date}}', { date: formatLocalizedDate(learner.lastActionAt, { style: 'short' }) })
            : t('No actions yet')}
      </span>
    </li>
  )
}
