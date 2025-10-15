import { CheckCircle2, MessageSquare, Vote } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { createPostUrl } from '@hylo/navigation'
import { DateTimeHelpers } from '@hylo/shared'
import useRouteParams from 'hooks/useRouteParams'
import orm from 'store/models'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { isEmpty } from 'lodash/fp'
import presentPost from 'store/presenters/presentPost'
import { cn } from 'util/index'
import { getLocaleFromLocalStorage } from 'util/locale'
import SubmissionCard from './SubmissionCard'

const getPosts = ormCreateSelector(
  orm,
  (session, round, sortByTokens) => round.submissions,
  (session, posts, sortByTokens) => {
    if (isEmpty(posts)) return []
    const sorted = posts.sort((a, b) => {
      if (sortByTokens) {
        // Sort by total tokens allocated (descending), then by ID
        return (b.totalTokensAllocated || 0) - (a.totalTokensAllocated || 0) || a.id - b.id
      }
      return a.id - b.id
    })
    return sorted.map(p => presentPost(p))
  }
)

export default function SubmissionsTab ({ canManageRound, round }) {
  const { isParticipating } = round
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const navigate = useNavigate()
  const [localVoteAmounts, setLocalVoteAmounts] = React.useState({})

  // Determine current phase first to know if we should sort by tokens
  const now = new Date()
  const submissionsOpenAt = DateTimeHelpers.toDateTime(round.submissionsOpenAt, { locale: getLocaleFromLocalStorage() })
  const submissionsCloseAt = DateTimeHelpers.toDateTime(round.submissionsCloseAt, { locale: getLocaleFromLocalStorage() })
  const votingOpensAt = DateTimeHelpers.toDateTime(round.votingOpensAt, { locale: getLocaleFromLocalStorage() })
  const votingClosesAt = DateTimeHelpers.toDateTime(round.votingClosesAt, { locale: getLocaleFromLocalStorage() })
  let currentPhase = 'draft'
  if (round.votingClosesAt && votingClosesAt <= now) {
    currentPhase = 'completed'
  } else if (round.votingOpensAt && votingOpensAt <= now) {
    currentPhase = 'voting'
  } else if (round.submissionsCloseAt && submissionsCloseAt <= now) {
    currentPhase = 'discussion'
  } else if (round.submissionsOpenAt && submissionsOpenAt <= now) {
    currentPhase = 'submissions'
  } else if (round.publishedAt && round.publishedAt <= now) {
    currentPhase = 'open'
  }

  const posts = useSelector(state => getPosts(state, round, currentPhase === 'completed'))

  // Initialize local vote amounts when posts change
  React.useEffect(() => {
    const initialAmounts = {}
    posts.forEach(post => {
      initialAmounts[post.id] = post.tokensAllocated || 0
    })
    setLocalVoteAmounts(initialAmounts)
  }, [posts.map(p => `${p.id}:${p.tokensAllocated}`).join(',')])

  // Calculate instant remaining tokens based on local vote amounts
  const currentTokensRemaining = React.useMemo(() => {
    if (round.tokensRemaining == null) return null

    // Start with the round's base remaining tokens
    let remaining = round.tokensRemaining

    // Add back any tokens that were originally allocated
    posts.forEach(post => {
      remaining += (post.tokensAllocated || 0)
    })

    // Subtract current local vote amounts
    Object.values(localVoteAmounts).forEach(amount => {
      remaining -= amount
    })

    return remaining
  }, [round.tokensRemaining, posts, localVoteAmounts])

  return (
    <div className={cn({ 'pointer-events-none opacity-50': !isParticipating })}>
      <div className='mt-4 rounded-md border-dashed border-2 border-foreground/20 p-2 text-sm font-semibold flex flex-col gap-2'>
        {currentPhase === 'open' && round.submissionsOpenAt && <span>{t('Submissions open at {{date}}', { date: DateTimeHelpers.formatDatePair({ start: round.submissionsOpenAt }) })}</span>}
        {currentPhase === 'submissions' && <h2>{t('Submissions open!')}</h2>}
        {currentPhase === 'submissions' && round.submissionsCloseAt && <span>{t('Submissions close at {{date}}', { date: DateTimeHelpers.formatDatePair({ start: round.submissionsCloseAt }) })}</span>}
        {currentPhase === 'submissions' && round.votingOpensAt && <span>{t('Voting opens at {{date}}', { date: DateTimeHelpers.formatDatePair({ start: round.votingOpensAt }) })}</span>}
        {currentPhase === 'discussion' && (
          <div className='flex flex-col gap-2'>
            <div className='flex items-start gap-3'>
              <MessageSquare className='w-6 h-6 text-selected flex-shrink-0 mt-0.5' />
              <div className='flex-1 flex flex-col gap-2'>
                <div className='flex items-center justify-between'>
                  <h2 className='text-lg font-bold text-selected'>{t('Discussion in progress')}</h2>
                  {posts.length > 0 && (
                    <span className='bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1'>
                      <span className='w-2 h-2 bg-white rounded-full' />
                      {t('{{count}} {{submissionDescriptor}}', {
                        count: posts.length,
                        submissionDescriptor: round.submissionDescriptorPlural
                      })}
                    </span>
                  )}
                </div>
                <p className='text-sm font-normal text-foreground/80'>
                  {t('Submissions are closed. Discover submissions and join the conversation.')}
                </p>
                {round.votingOpensAt && (
                  <p className='text-sm font-semibold'>
                    {t('Voting begins {{date}}', {
                      date: DateTimeHelpers.formatDatePair({ start: round.votingOpensAt })
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        {currentPhase === 'voting' && (
          <div className='flex flex-col'>
            <div className='flex flex-row gap-2 items-center'>
              <h2 className='text-lg font-bold text-selected flex-1 flex items-center gap-2 my-1'>
                <span className='inline-block w-6 h-6 bg-selected/50 rounded-sm flex items-center justify-center'>
                  <Vote className='inline-block w-5 h-5 text-foreground' />
                </span>
                {t('Voting in progress')}
              </h2>
              {currentTokensRemaining != null && (
                <div className='bg-selected/20 border-2 border-selected rounded-md py-1 px-2 font-bold text-sm'>
                  {t('You have {{tokens}} {{tokenType}} remaining', {
                    tokens: currentTokensRemaining,
                    tokenType: round.tokenType || 'votes'
                  })}
                </div>)}
            </div>
            <div className='flex flex-row gap-2'>
              <div className='flex-1'>
                <p className='text-sm text-foreground/80'>{t('Allocate your {{tokenType}} to the {{submissionDescriptor}} you think deserve support', { tokenType: round.tokenType || t('Votes'), submissionDescriptor: round.submissionDescriptor })}</p>
                {round.votingClosesAt && <span>{t('Voting closes at {{date}}', { date: DateTimeHelpers.formatDatePair({ start: round.votingClosesAt }) })}</span>}
              </div>
              <div>
                <p className='text-sm text-foreground/80 mb-1'>{round.minTokenAllocation && t('Minimum of {{minTokenAllocation}} {{tokenType}} / {{submissionDescriptor}}', { minTokenAllocation: round.minTokenAllocation, tokenType: round.tokenType || t('Votes'), submissionDescriptor: round.submissionDescriptor })}</p>
                <p className='text-sm text-foreground/80 mb-1'>{round.maxTokenAllocation && t('Maximum of {{maxTokenAllocation}} {{tokenType}} / {{submissionDescriptor}}', { maxTokenAllocation: round.maxTokenAllocation, tokenType: round.tokenType || t('Votes'), submissionDescriptor: round.submissionDescriptor })}</p>
              </div>
            </div>
          </div>
        )}
        {currentPhase === 'completed' && (
          <div className='flex flex-row items-center justify-between gap-4 py-2'>
            <div className='flex items-center gap-3'>
              <CheckCircle2 className='w-8 h-8 text-selected flex-shrink-0' />
              <h2 className='text-xl font-bold text-selected'>{t('Round Complete!')}</h2>
            </div>
            <div className='text-right'>
              <span className='text-base font-semibold text-foreground/80'>
                {t('{{numParticipants}} Participants allocated {{totalTokens}} {{tokenType}}!', {
                  numParticipants: round.numParticipants || 0,
                  totalTokens: round.totalTokensAllocated || 0,
                  tokenType: round.tokenType || t('votes')
                })}
              </span>
            </div>
          </div>
        )}
      </div>
      {currentPhase === 'submissions' && (
        <button
          className='my-4 w-full text-foreground border-2 border-foreground/20 hover:border-foreground/100 transition-all px-4 py-2 rounded-md mb-4'
          onClick={() => navigate(createPostUrl(routeParams, { newPostType: 'submission' }))}
        >
          + {t('Add {{submissionDescriptor}}', { submissionDescriptor: round?.submissionDescriptor })}
        </button>
      )}
      <div className='flex flex-col mt-4'>
        {(['completed', 'voting', 'discussion'].includes(currentPhase) || canManageRound) && posts.map(post => (
          <SubmissionCard
            key={post.id}
            post={post}
            canManageRound={canManageRound}
            currentPhase={currentPhase}
            round={round}
            localVoteAmount={localVoteAmounts[post.id] || 0}
            setLocalVoteAmount={(amount) => setLocalVoteAmounts(prev => ({ ...prev, [post.id]: amount }))}
            currentTokensRemaining={currentTokensRemaining}
          />
        ))}
      </div>
    </div>
  )
}
