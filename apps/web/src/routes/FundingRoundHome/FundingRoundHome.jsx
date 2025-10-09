import { capitalize, isEmpty } from 'lodash/fp'
import { BadgeDollarSign, Check, ChevronsRight, DoorOpen, Eye, MessageSquare, Settings } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, Routes, Route, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { createPostUrl, groupUrl, personUrl } from '@hylo/navigation'
import { DateTimeHelpers } from '@hylo/shared'
import CreateModal from 'components/CreateModal'
import Loading from 'components/Loading'
import HyloHTML from 'components/HyloHTML'
import NotFound from 'components/NotFound'
import PostCard from 'components/PostCard'
import PostDialog from 'components/PostDialog'
import Button from 'components/ui/button'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import ChatRoom from 'routes/ChatRoom'
import { FETCH_FUNDING_ROUND, fetchFundingRound, leaveFundingRound, joinFundingRound, updateFundingRound } from 'store/actions/fundingRoundActions'
import { RESP_MANAGE_ROUNDS } from 'store/constants'
import orm from 'store/models'
import presentPost from 'store/presenters/presentPost'
import getFundingRound from 'store/selectors/getFundingRound'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import useRouteParams from 'hooks/useRouteParams'
import { cn } from 'util/index'
import { getLocaleFromLocalStorage } from 'util/locale'

const getPosts = ormCreateSelector(
  orm,
  (session, round) => round.submissions,
  (session, posts) => {
    if (isEmpty(posts)) return []
    return posts
      .sort((a, b) => a.id - b.id)
      .map(p => presentPost(p))
  }
)

function FundingRoundHome () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useRouteParams()
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const fundingRound = useSelector(state => getFundingRound(state, routeParams.fundingRoundId))
  const isLoading = useSelector(state => state.pending && state.pending[FETCH_FUNDING_ROUND])
  const canEdit = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_MANAGE_ROUNDS, groupId: currentGroup?.id }))
  const [container, setContainer] = useState(null)

  const currentTab = routeParams['*'] || 'about'

  useEffect(() => {
    if (routeParams.fundingRoundId) dispatch(fetchFundingRound(routeParams.fundingRoundId))
  }, [routeParams.fundingRoundId])

  const handleJoinFundingRound = useCallback(() => {
    dispatch(joinFundingRound(fundingRound.id))
  }, [fundingRound?.id])

  const handlePublishRound = useCallback((publishedAt) => {
    if (confirm(publishedAt ? t('Are you sure you want to publish this round?') : t('Are you sure you want to unpublish this round?'))) {
      dispatch(updateFundingRound({ id: fundingRound.id, publishedAt }))
    }
  }, [fundingRound?.id])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({ icon: <BadgeDollarSign />, title: (fundingRound?.title || t('Funding Round')) + ' > ' + capitalize(currentTab) })
  }, [fundingRound?.title, currentTab])

  if (isLoading) return <Loading />
  if (!isLoading && !fundingRound) return <NotFound />

  return (
    <div className='w-full h-full' ref={setContainer}>
      <div className='pt-4 px-4 w-full h-full relative overflow-y-auto flex flex-col'>
        <div className='w-full h-full max-w-[750px] mx-auto flex-1 flex flex-col'>
          {(fundingRound.isParticipating || canEdit) && (
            <div className='flex gap-2 w-full justify-center items-center bg-black/20 rounded-md p-2'>
              <Link
                className={`py-1 px-4 rounded-md border-2 !text-foreground border-foreground/20 hover:text-foreground hover:border-foreground transition-all ${currentTab === 'about' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
                to=''
              >
                {t('About')}
              </Link>
              <Link
                className={`py-1 px-4 rounded-md border-2 !text-foreground border-foreground/20 hover:text-foreground hover:border-foreground transition-all ${currentTab === 'submissions' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
                to='submissions'
              >
                {fundingRound.submissionDescriptorPlural}
              </Link>
              <Link
                className={`py-1 px-4 rounded-md border-2 !text-foreground border-foreground/20 hover:text-foreground hover:border-foreground transition-all ${currentTab === 'participants' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
                to='participants'
              >
                {t('Participants')}
                {fundingRound.users?.length > 0 && (
                  <span className='ml-2 bg-black/20 text-xs font-bold px-2 py-0.5 rounded-full'>
                    {fundingRound.users.length}
                  </span>
                )}
              </Link>
              <Link
                className={`py-1 px-4 rounded-md border-2 !text-foreground border-foreground/20 hover:text-foreground hover:border-foreground transition-all ${currentTab === 'chat' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
                to='chat'
              >
                {t('Chat')}
              </Link>
              {canEdit && (
                <Link
                  className={`py-1 px-4 rounded-md border-2 !text-foreground border-foreground/20 hover:text-foreground hover:border-foreground transition-all ${currentTab === 'edit' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
                  to='manage'
                >
                  {t('Manage')}
                </Link>
              )}
            </div>)}

          <Routes>
            <Route path='submissions/*' element={<SubmissionsTab round={fundingRound} canEdit={canEdit} />} />
            <Route path='participants/*' element={<PeopleTab round={fundingRound} />} />
            <Route path='chat/*' element={<ChatTab fundingRound={fundingRound} />} />
            <Route path='edit/*' element={<CreateModal context='groups' editingFundingRound />} />
            <Route path='manage/*' element={<ManageTab round={fundingRound} />} />
            <Route path='post/:postId' element={<PostDialog container={container} />} />
            <Route path='post/:postId/edit/*' element={<PostDialog container={container} editingPost />} />
            <Route path='*' element={<AboutTab round={fundingRound} />} />
          </Routes>

          <div className='absolute bottom-0 right-0 left-0 flex flex-row gap-2 mx-auto w-full max-w-[750px] px-4 py-2 items-center bg-input rounded-t-md'>
            {!fundingRound.publishedAt
              ? (
                <>
                  <span className='flex-1'>{t('This round is not yet published')}</span>
                  <Button
                    variant='secondary'
                    onClick={(e) => handlePublishRound(new Date().toISOString())}
                  >
                    <Eye className='w-5 h-5 inline-block' /> <span className='inline-block'>{t('Publish')}</span>
                  </Button>
                </>
                )
              : fundingRound.isParticipating
                ? (
                  <>
                    <div className='flex flex-row gap-2 items-center justify-between w-full'>
                      <span className='flex flex-row gap-2 items-center'><Check className='w-4 h-4 text-selected' /> {t('You have joined this funding round')}</span>
                      <button
                        className='border-2 border-foreground/20 flex flex-row gap-2 items-center rounded-md p-2 px-4'
                        onClick={() => dispatch(leaveFundingRound(fundingRound.id))}
                      >
                        <DoorOpen className='w-4 h-4' /> {t('Leave Round')}
                      </button>
                    </div>
                  </>
                  )
                : (
                  <div className='flex flex-row gap-2 items-center justify-between w-full'>
                    <span>{t('Ready to jump in?')}</span>
                    <button
                      className='bg-selected text-foreground rounded-md p-2 px-4 flex flex-row gap-2 items-center'
                      onClick={handleJoinFundingRound}
                    >
                      <ChevronsRight className='w-4 h-4' /> {t('Join')}
                    </button>
                  </div>
                  )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Info ({ label, value }) {
  return (
    <div className='border border-foreground/20 rounded-lg p-3'>
      <div className='text-xs text-foreground/60 uppercase'>{label}</div>
      <div className='text-base'>{value}</div>
    </div>
  )
}

function AboutTab ({ round }) {
  const { t } = useTranslation()
  return (
    <div className='flex flex-col gap-3'>
      <h1 className='text-2xl font-bold'>{round.title}</h1>
      {round.description && (
        <HyloHTML html={round.description} />
      )}
      {round.criteria && (
        <div>
          <div className='font-semibold'>{t('Criteria')}</div>
          <HyloHTML html={round.criteria} />
        </div>
      )}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <Info label={t('Require Budget')} value={round.requireBudget ? t('Yes') : t('No')} />
        <Info label={t('Voting Method')} value={round.votingMethod} />
        {round.tokenType && <Info label={t('Token Type')} value={round.tokenType} />}
        {round.totalTokens != null && <Info label={t('Total Tokens')} value={round.totalTokens} />}
        {round.minTokenAllocation != null && <Info label={t('Min Token Allocation')} value={round.minTokenAllocation} />}
        {round.maxTokenAllocation != null && <Info label={t('Max Token Allocation')} value={round.maxTokenAllocation} />}
      </div>
    </div>
  )
}

function SubmissionsTab ({ canEdit, round }) {
  const posts = useSelector(state => getPosts(state, round))
  const { isParticipating } = round
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const navigate = useNavigate()

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
        {currentPhase === 'voting' && <h2>{t('Voting open!')}</h2>}
        {currentPhase === 'voting' && round.votingClosesAt && <span>{t('Voting closes at {{date}}', { date: DateTimeHelpers.formatDatePair({ start: round.votingClosesAt }) })}</span>}
        {currentPhase === 'completed' && <h2>{t('Voting closed. See results below.')}</h2>}
      </div>
      {currentPhase === 'submissions' && (
        <button
          className='my-4 w-full text-foreground border-2 border-foreground/20 hover:border-foreground/100 transition-all px-4 py-2 rounded-md mb-4'
          onClick={() => navigate(createPostUrl(routeParams, { newPostType: 'submission' }))}
        >
          + {t('Add {{submissionDescriptor}}', { submissionDescriptor: round?.submissionDescriptor })}
        </button>
      )}
      {(['completed', 'voting', 'discussion'].includes(currentPhase) || canEdit) && posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}

function PeopleTab ({ round }) {
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const { users } = round

  return (
    <div>
      {users?.length === 0 && <h1>{t('No one has joined this round')}</h1>}
      {users?.length > 0 && (
        <div className='flex flex-col gap-2 pt-4'>
          {users?.map(user => (
            <div key={user.id} className='flex flex-row gap-2 items-center justify-between'>
              <div>
                <Link to={personUrl(user.id, routeParams.groupSlug)} className='flex flex-row gap-2 items-center text-foreground'>
                  <img src={user.avatarUrl} alt={user.name} className='w-10 h-10 rounded-full my-2' />
                  <span>{user.name}</span>
                </Link>
              </div>
              <div className='flex flex-row gap-4 items-center text-xs text-foreground/60'>
                <div>
                  <span>submission</span>
                </div>
                <div>
                  <span>submitter? voter?</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ChatTab ({ fundingRound }) {
  return (
    <div className='flex-1 h-full overflow-hidden'>
      <ChatRoom customTopicName={`‡funding_round_${fundingRound.id}`} />
    </div>
  )
}

function ManageTab ({ round }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useRouteParams()
  const navigate = useNavigate()

  const now = new Date()
  const submissionsOpenAt = round.submissionsOpenAt ? DateTimeHelpers.toDateTime(round.submissionsOpenAt, { locale: getLocaleFromLocalStorage() }) : null
  const submissionsCloseAt = round.submissionsCloseAt ? DateTimeHelpers.toDateTime(round.submissionsCloseAt, { locale: getLocaleFromLocalStorage() }) : null
  const votingOpensAt = round.votingOpensAt ? DateTimeHelpers.toDateTime(round.votingOpensAt, { locale: getLocaleFromLocalStorage() }) : null
  const votingClosesAt = round.votingClosesAt ? DateTimeHelpers.toDateTime(round.votingClosesAt, { locale: getLocaleFromLocalStorage() }) : null

  // Determine current phase
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

  // Determine next phase and prepare data
  const phases = []
  let currentPhaseIndex = -1

  // Always show all phases, even if dates aren't set
  const isPastSubmissionsOpen = submissionsOpenAt && submissionsOpenAt <= now
  const isCurrentSubmissionsOpen = currentPhase === 'submissions'
  phases.push({
    key: 'submissionsOpen',
    label: isPastSubmissionsOpen ? t('Submissions opened') : t('Submissions open'),
    date: submissionsOpenAt,
    isPast: isPastSubmissionsOpen,
    isCurrent: isCurrentSubmissionsOpen,
    dateField: 'submissionsOpenAt',
    forwardButtonText: t('Open Now'),
    backButtonText: t('Pause Submissions'),
    backDateField: 'submissionsOpenAt'
  })
  if (isCurrentSubmissionsOpen) currentPhaseIndex = phases.length - 1

  const isPastSubmissionsClose = submissionsCloseAt && submissionsCloseAt <= now
  const isCurrentSubmissionsClose = currentPhase === 'discussion'
  phases.push({
    key: 'submissionsClose',
    label: isPastSubmissionsClose ? t('Submissions closed / Discussion open') : t('Submissions close / Discussion open'),
    date: submissionsCloseAt,
    isPast: isPastSubmissionsClose,
    isCurrent: isCurrentSubmissionsClose,
    dateField: 'submissionsCloseAt',
    forwardButtonText: t('Close Now'),
    backButtonText: t('Re-open Submissions'),
    backDateField: 'submissionsCloseAt'
  })
  if (isCurrentSubmissionsClose) currentPhaseIndex = phases.length - 1

  const isPastVotingOpens = votingOpensAt && votingOpensAt <= now
  const isCurrentVotingOpens = currentPhase === 'voting'
  phases.push({
    key: 'votingOpens',
    label: isPastVotingOpens ? t('Voting opened') : t('Voting opens'),
    date: votingOpensAt,
    isPast: isPastVotingOpens,
    isCurrent: isCurrentVotingOpens,
    dateField: 'votingOpensAt',
    forwardButtonText: t('Open Now'),
    backButtonText: t('Pause Voting'),
    backDateField: 'votingOpensAt'
  })
  if (isCurrentVotingOpens) currentPhaseIndex = phases.length - 1

  const isPastVotingCloses = votingClosesAt && votingClosesAt <= now
  const isCurrentVotingCloses = currentPhase === 'completed'
  phases.push({
    key: 'votingCloses',
    label: isPastVotingCloses ? t('Voting closed') : t('Voting closes'),
    date: votingClosesAt,
    isPast: isPastVotingCloses,
    isCurrent: isCurrentVotingCloses,
    dateField: 'votingClosesAt',
    forwardButtonText: t('Close Now'),
    backButtonText: t('Re-open Voting'),
    backDateField: 'votingClosesAt'
  })
  if (isCurrentVotingCloses) currentPhaseIndex = phases.length - 1

  const handleStartPhase = (phaseLabel, dateField) => {
    if (confirm(t('fundingRound.manuallyStartPhase', { phaseLabel }))) {
      dispatch(updateFundingRound({ id: round.id, [dateField]: new Date().toISOString() }))
    }
  }

  const handleGoBackPhase = (phaseLabel, dateField) => {
    // Going back means clearing the date to go back to the previous phase
    if (confirm(t('fundingRound.goBackPhase', { phaseLabel }))) {
      dispatch(updateFundingRound({ id: round.id, [dateField]: null }))
    }
  }

  return (
    <div className='flex flex-col gap-4 mt-4'>
      <button
        className='w-full text-foreground border-2 border-foreground/20 hover:border-foreground/100 transition-all px-4 py-2 rounded-md flex flex-row items-center gap-2 justify-center'
        onClick={() => navigate(groupUrl(routeParams.groupSlug, `funding-rounds/${round?.id}/edit`))}
      >
        <Settings className='w-4 h-4' />
        <span>{t('Edit Funding Round')}</span>
      </button>

      <div className='border border-foreground/20 rounded-lg p-4'>
        <h3 className='text-lg font-semibold mb-3'>{t('Phase Timeline')}</h3>
        <div className='flex flex-col gap-3'>
          {phases.map((phase, index) => {
            // If we're before any phase started, show button for first phase
            // Otherwise, show button only for the phase immediately after current
            const isNextPhase = currentPhaseIndex === -1
              ? index === 0
              : currentPhaseIndex >= 0 && index === currentPhaseIndex + 1
            const showForwardButton = !phase.isPast && !phase.isCurrent && isNextPhase
            const showBackButton = phase.isCurrent

            return (
              <div
                key={phase.key}
                className={cn(
                  'flex flex-row items-center justify-between p-3 rounded-md border',
                  phase.isCurrent
                    ? 'border-selected bg-selected/10 shadow-md'
                    : phase.isPast
                      ? 'border-foreground/10 bg-foreground/5'
                      : 'border-foreground/20'
                )}
              >
                <div className='flex flex-col gap-1'>
                  <div className='font-medium'>
                    {phase.label}
                    {phase.isCurrent && (
                      <span className='ml-2 text-xs text-selected font-bold'>({t('current')})</span>
                    )}
                  </div>
                  <div className='text-sm text-foreground/60'>
                    {phase.date ? DateTimeHelpers.formatDatePair({ start: phase.date }) : t('Not scheduled')}
                  </div>
                </div>
                <div className='flex gap-2'>
                  {showBackButton && (
                    <Button
                      variant='secondary'
                      size='sm'
                      onClick={() => handleGoBackPhase(phase.label, phase.backDateField)}
                    >
                      {phase.backButtonText}
                    </Button>
                  )}
                  {showForwardButton && (
                    <Button
                      variant='default'
                      size='sm'
                      onClick={() => handleStartPhase(phase.label, phase.dateField)}
                    >
                      <ChevronsRight className='w-4 h-4 mr-1' />
                      {phase.forwardButtonText}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default FundingRoundHome
