import { isEmpty } from 'lodash/fp'
import { CheckCircle2, MessageSquare, Vote, Lock, FileCheck2 } from 'lucide-react'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { createPostUrl } from '@hylo/navigation'
import { DateTimeHelpers } from '@hylo/shared'
import useRouteParams from 'hooks/useRouteParams'
import orm from 'store/models'
import presentPost from 'store/presenters/presentPost'
import getMe from 'store/selectors/getMe'
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
  const currentUser = useSelector(getMe)
  const routeParams = useRouteParams()
  const navigate = useNavigate()
  const [localVoteAmounts, setLocalVoteAmounts] = React.useState({})

  // Determine current phase first to know if we should sort by tokens
  const now = new Date()
  const submissionsOpenAt = round.submissionsOpenAt ? DateTimeHelpers.toDateTime(round.submissionsOpenAt, { locale: getLocaleFromLocalStorage() }) : null
  const submissionsCloseAt = round.submissionsCloseAt ? DateTimeHelpers.toDateTime(round.submissionsCloseAt, { locale: getLocaleFromLocalStorage() }) : null
  const votingOpensAt = round.votingOpensAt ? DateTimeHelpers.toDateTime(round.votingOpensAt, { locale: getLocaleFromLocalStorage() }) : null
  const votingClosesAt = round.votingClosesAt ? DateTimeHelpers.toDateTime(round.votingClosesAt, { locale: getLocaleFromLocalStorage() }) : null
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
  // During submission phase, only show posts created by the current user unless you are a steward
  const postsForDisplay = useMemo(() => ['voting', 'discussion', 'completed'].includes(currentPhase) || canManageRound ? posts : posts.filter(post => parseInt(post.creator.id) === parseInt(currentUser.id)), [canManageRound, posts, currentPhase, currentUser.id])

  // Initialize local vote amounts when posts change
  React.useEffect(() => {
    setLocalVoteAmounts(prev => {
      const newAmounts = { ...prev }
      posts.forEach(post => {
        // Only initialize if we don't have a local value yet, or if the post is new
        if (!(post.id in newAmounts)) {
          newAmounts[post.id] = post.tokensAllocated || 0
        }
      })
      return newAmounts
    })
  }, [posts.map(p => p.id).join(',')])

  // Sync local state with backend data when tokensAllocated changes
  React.useEffect(() => {
    setLocalVoteAmounts(prev => {
      const updated = { ...prev }
      let hasChanges = false
      posts.forEach(post => {
        // Always sync with backend value if it's different
        if (updated[post.id] !== post.tokensAllocated) {
          updated[post.id] = post.tokensAllocated || 0
          hasChanges = true
        }
      })
      return hasChanges ? updated : prev
    })
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
    <div className={cn({ 'pointer-events-none': !isParticipating })}>
      <div className='mt-4 rounded-md border-dashed border-2 border-foreground/20 p-4 text-sm font-semibold flex flex-col gap-2'>
        {(currentPhase === 'open' || currentPhase === 'draft') && !submissionsOpenAt && (
          <div className='flex items-center flex-col pt-2 justify-center'>
            <Lock className='w-6 h-6 text-foreground flex-shrink-0' />
            <h2 className='text-lg text-foreground mt-0 mb-0'>{t('Submissions are not open yet')}</h2>
            <p className='text-sm font-normal pt-0 mt-0 text-foreground/80'>{t('Check back soon to offer your {{submissionDescriptor}}', { submissionDescriptor: round.submissionDescriptor })}</p>
          </div>
        )}
        {currentPhase === 'open' && submissionsOpenAt && <span>{t('Submissions open at {{date}}', { date: DateTimeHelpers.formatDatePair({ start: round.submissionsOpenAt }) })}</span>}
        {currentPhase === 'submissions' && (
          <div className='flex flex-col items-start gap-2'>
            <div className='flex flex-row items-center gap-2 justify-between w-full'>
              <div className='flex flex-row items-center gap-2'>
                <div className='bg-selected/30 rounded-md py-1 px-2 font-bold text-sm h-8 w-8 flex items-center justify-center'>
                  <FileCheck2 className='w-6 h-6 text-foreground flex-shrink-0' />
                </div>
                <h2 className='text-xl text-selected mt-0 mb-0 font-bold'>{t('Submissions open!')}</h2>
              </div>
              <div>
                <span className='bg-selected/20 text-foreground text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1'>
                  <span className='w-2 h-2 bg-selected rounded-full' />
                  {t('{{count}} {{submissionDescriptor}}', {
                    count: posts.length,
                    submissionDescriptor: round.submissionDescriptorPlural
                  })}
                </span>
              </div>
            </div>
            {round.submissionsCloseAt && <span className='text-sm font-normal pt-0 mt-0 text-foreground/50'>{t('Submissions close at {{date}}', { date: DateTimeHelpers.formatDatePair({ start: round.submissionsCloseAt }) })}</span>}
            {round.votingOpensAt && <span className='text-sm font-normal pt-0 mt-0 text-foreground/50'>{t('Voting opens at {{date}}', { date: DateTimeHelpers.formatDatePair({ start: round.votingOpensAt }) })}</span>}
          </div>
        )}
        {currentPhase === 'discussion' && (
          <div className='flex flex-col gap-2'>
            <div className='flex items-start gap-3'>
              <div className='flex-1 flex flex-col gap-2'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <div className='bg-selected/30 rounded-md py-1 px-2 font-bold text-sm h-8 w-8 flex items-center justify-center'>
                      <MessageSquare className='w-4 h-6 text-foreground flex-shrink-0' />
                    </div>
                    <h2 className='text-xl font-bold text-selected mt-0 mb-0'>{t('Discussion in progress')}</h2>
                  </div>
                  {posts.length > 0 && (
                    <span className='bg-selected/20 text-foreground text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1'>
                      <span className='w-2 h-2 bg-selected rounded-full' />
                      {t('{{count}} {{submissionDescriptor}}', {
                        count: posts.length,
                        submissionDescriptor: round.submissionDescriptorPlural
                      })}
                    </span>
                  )}
                </div>
                <p className='text-sm font-normal text-foreground/80 mt-0 mb-0'>
                  {t('Submissions are closed. Discover submissions and join the conversation.')}
                </p>
                {round.votingOpensAt && (
                  <p className='text-sm font-semibold -mt-2 mb-0 pt-0'>
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
              <h2 className='text-xl font-bold text-selected flex-1 flex items-center gap-2 my-1'>
                <span className='inline-block w-8 h-8 bg-selected/50 rounded-sm flex items-center justify-center'>
                  <Vote className='inline-block w-6 h-6 text-foreground' />
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
            <div>
              <p className='text-sm text-foreground/80 mt-0 mb-0 pt-0 font-normal'>{t('Allocate your {{tokenType}} to the {{submissionDescriptor}} you think deserve support', { tokenType: round.tokenType || t('Votes'), submissionDescriptor: round.submissionDescriptor })}</p>
              {round.votingClosesAt && <span className='text-sm font-normal pt-0 mt-0 text-foreground/50'>{t('Voting closes at {{date}}', { date: DateTimeHelpers.formatDatePair({ start: round.votingClosesAt }) })}</span>}
            </div>
            <div className='flex flex-row gap-3 opacity-50'>
              <p className='text-xs text-foreground/80 mb-1 font-normal pt-0 mt-0 border-r-2 border-foreground/20 pr-2'>{round.minTokenAllocation && t('Minimum of {{minTokenAllocation}} {{tokenType}} / {{submissionDescriptor}}', { minTokenAllocation: round.minTokenAllocation, tokenType: round.tokenType || t('Votes'), submissionDescriptor: round.submissionDescriptor })}</p>
              <p className='text-xs text-foreground/80 mb-1 font-normal pt-0 mt-0'>{round.maxTokenAllocation && t('Maximum of {{maxTokenAllocation}} {{tokenType}} / {{submissionDescriptor}}', { maxTokenAllocation: round.maxTokenAllocation, tokenType: round.tokenType || t('Votes'), submissionDescriptor: round.submissionDescriptor })}</p>
            </div>
          </div>
        )}
        {currentPhase === 'completed' && (
          <div className='flex flex-row items-center justify-between gap-4'>
            <div className='flex items-center gap-3'>
              <div className='bg-selected/30 rounded-md py-1 px-2 font-bold text-sm h-8 w-8 flex items-center justify-center'>
                <CheckCircle2 className='w-6 h-6 text-foreground flex-shrink-0' />
              </div>
              <h2 className='text-xl font-bold text-selected mt-0 mb-0'>{t('Round Complete!')}</h2>
            </div>
            <div className='text-right'>
              <span className='text-base font-semibold text-foreground/80 mt-0 mb-0 pt-0'>
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
        {postsForDisplay.map(post => (
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
