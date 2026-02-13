import { isEmpty } from 'lodash/fp'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { createPostUrl } from '@hylo/navigation'
import useRouteParams from 'hooks/useRouteParams'
import orm from 'store/models'
import presentPost from 'store/presenters/presentPost'
import getMe from 'store/selectors/getMe'
import { cn } from 'util/index'
import { seededShuffle } from 'util/seededRandom'
import CreateModal from 'components/CreateModal'
import PostDialog from 'components/PostDialog'
import SubmissionCard from './SubmissionCard'
import RoundPhaseStatus from './RoundPhaseStatus'
import { getRoundPhaseMeta } from './phaseUtils'

const getPosts = ormCreateSelector(
  orm,
  (session, round, sortByTokens) => round.submissions,
  (session, round, sortByTokens) => sortByTokens,
  (session, posts, sortByTokens) => {
    if (isEmpty(posts)) return []
    const sorted = posts.sort((a, b) => {
      if (sortByTokens) {
        // Sort by total tokens allocated (descending), then by ID
        return (b.totalTokensAllocated || 0) - (a.totalTokensAllocated || 0) || b.id - a.id
      }
      return b.id - a.id
    })
    return sorted.map(p => presentPost(p))
  }
)

export default function SubmissionsTab ({ canManageRound, canSubmit, canVote, round }) {
  const { isParticipating } = round
  const { t } = useTranslation()
  const currentUser = useSelector(getMe)
  const routeParams = useRouteParams()
  const navigate = useNavigate()
  const [localVoteAmounts, setLocalVoteAmounts] = React.useState({})

  // Determine current phase first to know if we should sort by tokens
  const { currentPhase } = getRoundPhaseMeta(round)

  // When hiding results from participants, don't sort by tokens - use voting order instead
  // Managers should always see sorted results even when results are hidden from participants
  const shouldSortByTokens = currentPhase === 'completed' && (!round.hideFinalResultsFromParticipants || canManageRound)
  const posts = useSelector(state => getPosts(state, round, shouldSortByTokens))

  // During submission phase, only show posts created by the current user unless you are a steward
  // In voting mode, shuffle posts randomly but consistently per user using their ID as seed
  // In completed phase with hidden results, use the same voting order
  const postsForDisplay = useMemo(() => {
    let filtered = ['voting', 'discussion', 'completed'].includes(currentPhase) || canManageRound
      ? posts
      : posts.filter(post => parseInt(post.creator.id) === parseInt(currentUser.id))

    // In voting mode or completed phase with hidden results, shuffle using user ID as seed for consistent randomization
    if (currentUser?.id && (
      currentPhase === 'voting' ||
      (currentPhase === 'completed' && round.hideFinalResultsFromParticipants && !canManageRound)
    )) {
      filtered = seededShuffle(filtered, currentUser.id)
    }

    return filtered
  }, [canManageRound, posts, currentPhase, currentUser?.id, round.hideFinalResultsFromParticipants])

  const allocationsBySubmission = useMemo(() => {
    const map = {}
    const allocationList = Array.isArray(round.allocations)
      ? round.allocations
      : Array.isArray(round.allocations?.items)
        ? round.allocations.items
        : []

    allocationList.forEach(allocation => {
      const submissionId = allocation?.submission?.id
      if (!submissionId) return
      const key = String(submissionId)
      if (!map[key]) map[key] = []
      map[key].push(allocation)
    })
    return map
  }, [round.allocations])

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
      const numericAmount = typeof amount === 'number' ? amount : parseInt(amount, 10)
      remaining -= Number.isNaN(numericAmount) ? 0 : numericAmount
    })

    return remaining
  }, [round.tokensRemaining, posts, localVoteAmounts])

  return (
    <div className={cn({ 'pointer-events-none': !isParticipating })}>
      <RoundPhaseStatus
        round={round}
        canManageRound={canManageRound}
        canSubmit={canSubmit}
        canVote={canVote}
        currentPhase={currentPhase}
        submissionCount={posts.length}
        currentTokensRemaining={currentTokensRemaining}
      />
      {currentPhase === 'submissions' && canSubmit && (
        <button
          className='my-4 w-full text-foreground border-2 border-foreground/20 hover:border-foreground/50 transition-all px-4 py-2 rounded-md mb-4'
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
            canVote={canVote && !(currentPhase === 'completed' && round.hideFinalResultsFromParticipants && !canManageRound)}
            currentPhase={currentPhase}
            round={round}
            localVoteAmount={localVoteAmounts[post.id] ?? 0}
            setLocalVoteAmount={(amount) => setLocalVoteAmounts(prev => ({ ...prev, [post.id]: amount }))}
            currentTokensRemaining={currentTokensRemaining}
            submissionAllocations={allocationsBySubmission[String(post.id)] || []}
          />
        ))}
      </div>
      <Routes>
        {['submissions', 'discussion'].includes(currentPhase) && <Route path='post/:postId/edit/*' element={<CreateModal context='groups' editingPost />} />}
        <Route path='post/:postId' element={<PostDialog />} />
      </Routes>
    </div>
  )
}
