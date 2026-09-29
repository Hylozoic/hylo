import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { groupUrl } from '@hylo/navigation'
import Loading from 'components/Loading'
import RoundImage from 'components/RoundImage'
import Button from 'components/ui/button'
import { DEFAULT_AVATAR } from 'store/models/Group'
import { cn } from 'util/index'

export const FETCH_EXPLORER_REVIEW_LIST = 'ExplorerReview/FETCH_EXPLORER_REVIEW_LIST'
export const REVIEW_EXPLORER_GROUP = 'ExplorerReview/REVIEW_EXPLORER_GROUP'

const reviewGroupFields = `
  id
  name
  slug
  avatarUrl
  createdAt
  status
  memberCount
  recentPostCount
  lastPostAt
  meetsBar
`

export function fetchExplorerReviewList () {
  return {
    type: FETCH_EXPLORER_REVIEW_LIST,
    graphql: {
      query: `query ExplorerReviewList {
        explorerReviewList {
          minMembers
          activityWindowDays
          pending { ${reviewGroupFields} }
          keepOrUnlist { ${reviewGroupFields} }
        }
      }`,
      variables: {}
    }
  }
}

export function reviewExplorerGroup (groupId, decision) {
  return {
    type: REVIEW_EXPLORER_GROUP,
    graphql: {
      query: `mutation ReviewExplorerGroup ($groupId: ID!, $decision: String!) {
        reviewExplorerGroup(groupId: $groupId, decision: $decision) { id status }
      }`,
      variables: { groupId, decision }
    }
  }
}

/**
 * Hylo admin page: decide which Public groups appear in the Group Explorer.
 */
export default function ExplorerReview () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [list, setList] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    dispatch(fetchExplorerReviewList())
      .then(result => {
        const data = result?.payload?.data?.explorerReviewList
        if (data) setList(data)
        else setError(t('Something went wrong. Please try again.'))
      })
      .catch(() => setError(t('Something went wrong. Please try again.')))
      .finally(() => setLoading(false))
  }, [dispatch, t])

  const decide = useCallback(async (group, decision, section) => {
    setBusyId(group.id)
    setError(null)
    try {
      const result = await dispatch(reviewExplorerGroup(group.id, decision))
      if (result?.error || !result?.payload?.data?.reviewExplorerGroup) {
        setError(t('Something went wrong. Please try again.'))
        return
      }
      setList(current => ({ ...current, [section]: current[section].filter(g => g.id !== group.id) }))
    } catch (e) {
      setError(t('Something went wrong. Please try again.'))
    } finally {
      setBusyId(null)
    }
  }, [dispatch, t])

  if (loading) return <Loading />

  const minMembers = list?.minMembers ?? 3
  const days = list?.activityWindowDays ?? 90
  const pending = list?.pending || []
  const keepOrUnlist = list?.keepOrUnlist || []

  return (
    <div className='p-6 max-w-4xl mx-auto' data-testid='explorer-review'>
      <h1 className='text-2xl font-bold mb-2'>{t('New public groups')}</h1>
      <p className='text-sm text-foreground/60 mb-6'>
        {t('Approved groups appear in the Group Explorer. The recommendation uses a bar of {{minMembers}} or more members and a post in the last {{days}} days.', { minMembers, days })}
      </p>
      {error && <p className='text-sm text-destructive mb-4' role='alert'>{error}</p>}

      {pending.length === 0
        ? <div className='text-foreground/50 p-4 border border-foreground/20 rounded-md mb-8'>{t('No groups are waiting for review.')}</div>
        : (
          <ul className='divide-y divide-foreground/10 border border-foreground/20 rounded-md mb-8'>
            {pending.map(group => (
              <ReviewRow
                key={group.id}
                group={group}
                days={days}
                busy={busyId === group.id}
                recommendation={group.meetsBar ? t('Recommended: Approve') : t('Recommended: Deny')}
                actions={[
                  { label: t('Approve'), variant: 'default', onClick: () => decide(group, 'approve', 'pending') },
                  { label: t('Deny'), variant: 'secondary', onClick: () => decide(group, 'deny', 'pending') }
                ]}
              />
            ))}
          </ul>
          )}

      {keepOrUnlist.length > 0 && (
        <section data-testid='explorer-recheck'>
          <h2 className='text-lg font-semibold mb-2'>{t('Listed groups to recheck')}</h2>
          <p className='text-sm text-foreground/60 mb-4'>
            {t('These groups are listed in the Group Explorer but no longer pass the bar. Keep them listed or unlist them.')}
          </p>
          <ul className='divide-y divide-foreground/10 border border-foreground/20 rounded-md'>
            {keepOrUnlist.map(group => (
              <ReviewRow
                key={group.id}
                group={group}
                days={days}
                busy={busyId === group.id}
                recommendation={group.meetsBar ? t('Recommended: Keep') : t('Recommended: Unlist')}
                actions={[
                  { label: t('Keep'), variant: 'secondary', onClick: () => decide(group, 'keep', 'keepOrUnlist') },
                  { label: t('Unlist'), variant: 'destructive', onClick: () => decide(group, 'unlist', 'keepOrUnlist') }
                ]}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function ReviewRow ({ group, days, busy, recommendation, actions }) {
  const { t } = useTranslation()
  const formatDate = value => value ? new Date(value).toLocaleDateString() : null
  const lastPost = formatDate(group.lastPostAt)

  return (
    <li className='p-4 flex items-start gap-4' data-testid='explorer-review-row'>
      <RoundImage url={group.avatarUrl || DEFAULT_AVATAR} size='40px' square />
      <div className='min-w-0 flex-1'>
        <Link to={groupUrl(group.slug, 'about')} className='font-bold text-foreground hover:underline'>{group.name}</Link>
        <p className='text-xs text-foreground/60 mt-1'>
          {t('Created {{date}}', { date: formatDate(group.createdAt) })}
          {' · '}
          {t('Members: {{count}}', { count: group.memberCount })}
          {' · '}
          {t('Posts in the last {{days}} days: {{count}}', { days, count: group.recentPostCount })}
          {' · '}
          {lastPost ? t('Last post {{date}}', { date: lastPost }) : t('No posts yet')}
        </p>
        <span
          className={cn(
            'inline-block mt-2 rounded-full px-2 py-0.5 text-xs font-medium',
            group.meetsBar ? 'bg-selected/30 text-foreground' : 'bg-foreground/10 text-foreground/70'
          )}
        >
          {recommendation}
        </span>
      </div>
      <div className='flex gap-2 shrink-0'>
        {actions.map(action => (
          <Button key={action.label} variant={action.variant} size='sm' disabled={busy} onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
      </div>
    </li>
  )
}
