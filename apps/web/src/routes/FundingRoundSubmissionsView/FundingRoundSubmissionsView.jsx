import { ClipboardList } from 'lucide-react'
import { isEmpty } from 'lodash/fp'
import React, { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { createPostUrl } from '@hylo/navigation'
import CreateModal from 'components/CreateModal'
import Loading from 'components/Loading'
import PostDialog from 'components/PostDialog'
import { useEffectiveGroupSlug, useGroupRouteOpts } from 'contexts/SpaceGroupContext'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import {
  FETCH_FUNDING_ROUND,
  fetchFundingRound,
  fetchFundingRoundSubmissions,
  FETCH_FUNDING_ROUND_SUBMISSIONS,
  doPhaseTransition,
  needsPhaseTransition
} from 'routes/FundingRounds/FundingRounds.store'
import { RESP_ADMINISTRATION } from 'store/constants'
import orm from 'store/models'
import presentPost from 'store/presenters/presentPost'
import getFundingRound from 'store/selectors/getFundingRound'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import getRolesForGroup from 'store/selectors/getRolesForGroup'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import isPendingFor from 'store/selectors/isPendingFor'
import { cn } from 'util/index'
import { seededShuffle } from 'util/seededRandom'

import RoundPhaseStatus from './RoundPhaseStatus'
import SubmissionCard from './SubmissionCard'
import { getRoundPhaseMeta } from './phaseUtils'

const getPosts = ormCreateSelector(
  orm,
  (session, round, sortByTokens) => round.submissions,
  (session, round, sortByTokens) => sortByTokens,
  (session, posts, sortByTokens) => {
    if (isEmpty(posts)) return []
    const sorted = posts.sort((a, b) => {
      if (sortByTokens) {
        return (b.totalTokensAllocated || 0) - (a.totalTokensAllocated || 0) || b.id - a.id
      }
      return b.id - a.id
    })
    return sorted.map(p => presentPost(p))
  }
)

/** Renders a Funding Round space's submissions with voting UI. */
export default function FundingRoundSubmissionsView () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const currentUser = useSelector(getMe)
  const routeParams = useRouteParams()
  const groupSlug = useEffectiveGroupSlug()
  const { parentGroupSlug } = useGroupRouteOpts()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const parentGroup = useSelector(state => parentGroupSlug ? getGroupForSlug(state, parentGroupSlug) : null)
  const round = useSelector(state => {
    const nested = group?.fundingRound
    if (!nested?.id) return null
    return getFundingRound(state, nested.id) || nested
  })
  const roundId = round?.id || group?.fundingRound?.id
  const roleGroupId = group?.parentId || parentGroup?.id || group?.id
  const canManageRound = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: roleGroupId }))
  const isLoadingRound = useSelector(state => isPendingFor(FETCH_FUNDING_ROUND, state))
  const isLoadingSubmissions = useSelector(state => isPendingFor(FETCH_FUNDING_ROUND_SUBMISSIONS, state))
  const [localVoteAmounts, setLocalVoteAmounts] = React.useState({})

  const currentUserRoles = useSelector(state => getRolesForGroup(state, { person: currentUser, groupId: roleGroupId }))
  const canSubmit = useMemo(() => {
    if (!round?.isParticipating) return false
    if (!round?.submitterRoles?.length) return true
    return currentUserRoles.some(r => round.submitterRoles.map(role => role.id).includes(r.id))
  }, [round?.isParticipating, currentUserRoles, round?.submitterRoles])

  const canVote = useMemo(() => {
    if (!round?.isParticipating) return false
    if (!round?.voterRoles?.length) return true
    return currentUserRoles.some(r => round.voterRoles.map(role => role.id).includes(r.id))
  }, [round?.isParticipating, currentUserRoles, round?.voterRoles])

  useEffect(() => {
    if (roundId) dispatch(fetchFundingRound(roundId))
  }, [roundId])

  useEffect(() => {
    if (roundId) dispatch(fetchFundingRoundSubmissions(roundId))
  }, [roundId])

  useEffect(() => {
    if (round && round.isParticipating && needsPhaseTransition(round)) {
      dispatch(doPhaseTransition(round.id))
    }
  }, [
    round?.phase,
    round?.publishedAt,
    round?.submissionsOpenAt,
    round?.submissionsCloseAt,
    round?.votingOpensAt,
    round?.votingClosesAt,
    round?.isParticipating,
    round?.id
  ])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: round?.submissionDescriptorPlural || t('Submissions'),
      search: false,
      icon: <ClipboardList />
    })
  }, [round?.submissionDescriptorPlural, t])

  const { currentPhase } = getRoundPhaseMeta(round || {})
  const shouldSortByTokens = currentPhase === 'completed' && (!round?.hideFinalResultsFromParticipants || canManageRound)
  const posts = useSelector(state => round ? getPosts(state, round, shouldSortByTokens) : [])

  const postsForDisplay = useMemo(() => {
    if (!round) return []
    let filtered = ['voting', 'discussion', 'completed'].includes(currentPhase) || canManageRound
      ? posts
      : posts.filter(post => parseInt(post.creator.id) === parseInt(currentUser.id))

    if (currentUser?.id && (
      currentPhase === 'voting' ||
      (currentPhase === 'completed' && round.hideFinalResultsFromParticipants && !canManageRound)
    )) {
      filtered = seededShuffle(filtered, currentUser.id)
    }

    return filtered
  }, [canManageRound, posts, currentPhase, currentUser?.id, round?.hideFinalResultsFromParticipants])

  const allocationsBySubmission = useMemo(() => {
    const map = {}
    const allocationList = Array.isArray(round?.allocations)
      ? round.allocations
      : Array.isArray(round?.allocations?.items)
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
  }, [round?.allocations])

  React.useEffect(() => {
    setLocalVoteAmounts(prev => {
      const newAmounts = { ...prev }
      posts.forEach(post => {
        if (!(post.id in newAmounts)) {
          newAmounts[post.id] = post.tokensAllocated || 0
        }
      })
      return newAmounts
    })
  }, [posts.map(p => p.id).join(',')])

  React.useEffect(() => {
    setLocalVoteAmounts(prev => {
      const updated = { ...prev }
      let hasChanges = false
      posts.forEach(post => {
        if (updated[post.id] !== post.tokensAllocated) {
          updated[post.id] = post.tokensAllocated || 0
          hasChanges = true
        }
      })
      return hasChanges ? updated : prev
    })
  }, [posts.map(p => `${p.id}:${p.tokensAllocated}`).join(',')])

  const currentTokensRemaining = React.useMemo(() => {
    if (round?.tokensRemaining == null) return null

    let remaining = round.tokensRemaining
    posts.forEach(post => {
      remaining += (post.tokensAllocated || 0)
    })
    Object.values(localVoteAmounts).forEach(amount => {
      const numericAmount = typeof amount === 'number' ? amount : parseInt(amount, 10)
      remaining -= Number.isNaN(numericAmount) ? 0 : numericAmount
    })

    return remaining
  }, [round?.tokensRemaining, posts, localVoteAmounts])

  if (!roundId || (isLoadingRound && !round?.phase)) return <Loading />
  if (!round) return null

  const { isParticipating } = round

  return (
    <>
      <div className={cn(
        'flex flex-col flex-1 w-full mx-auto p-1 sm:p-4 max-w-[750px]',
        { 'pointer-events-none': !isParticipating && !canManageRound }
      )}
      >
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
            + {t('Add {{submissionDescriptor}}', { submissionDescriptor: round?.submissionDescriptor || t('Submission') })}
          </button>
        )}
        <div className='flex flex-col mt-4'>
          {isLoadingSubmissions && postsForDisplay.length === 0 && (
            <Loading />
          )}
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
    </>
  )
}
