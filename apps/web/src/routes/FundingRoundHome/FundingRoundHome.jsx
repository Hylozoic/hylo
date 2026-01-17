import { BadgeDollarSign } from 'lucide-react'
import React, { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CreateModal from 'components/CreateModal'
import Loading from 'components/Loading'
import NotFound from 'components/NotFound'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import ChatRoom from 'routes/ChatRoom'
import { FETCH_FUNDING_ROUND, fetchFundingRound, doPhaseTransition, needsPhaseTransition } from 'routes/FundingRounds/FundingRounds.store'
import { RESP_MANAGE_ROUNDS } from 'store/constants'
import getFundingRound from 'store/selectors/getFundingRound'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import getRolesForGroup from 'store/selectors/getRolesForGroup'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import useRouteParams from 'hooks/useRouteParams'
import AboutTab from './AboutTab'
import PeopleTab from './PeopleTab'
import SubmissionsTab from './SubmissionsTab'
import ManageTab from './ManageTab'

function FundingRoundHome () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useRouteParams()
  const currentUser = useSelector(getMe)
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const fundingRound = useSelector(state => getFundingRound(state, routeParams.fundingRoundId))
  const isLoading = useSelector(state => state.pending && state.pending[FETCH_FUNDING_ROUND])
  const canManageRound = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_MANAGE_ROUNDS, groupId: currentGroup?.id }))

  const currentTab = routeParams.tab || 'about'

  // Check if current user has permission to submit
  const currentUserRoles = useSelector(state => getRolesForGroup(state, { person: currentUser, groupId: currentGroup?.id }))
  const canSubmit = useMemo(() => {
    if (!fundingRound?.isParticipating) return false
    if (!fundingRound?.submitterRoles?.length) return true
    return currentUserRoles.some(r => fundingRound?.submitterRoles?.map(r => r.id).includes(r.id))
  }, [fundingRound?.isParticipating, currentUserRoles, fundingRound?.submitterRoles])

  const canVote = useMemo(() => {
    if (!fundingRound?.isParticipating) return false
    if (!fundingRound?.voterRoles?.length) return true
    return currentUserRoles.some(r => fundingRound?.voterRoles?.map(r => r.id).includes(r.id))
  }, [fundingRound?.isParticipating, currentUserRoles, fundingRound?.voterRoles])

  useEffect(() => {
    if (routeParams.fundingRoundId) dispatch(fetchFundingRound(routeParams.fundingRoundId))
  }, [routeParams.fundingRoundId])

  // Trigger phase transition if a timestamp has passed but phase hasn't been updated
  useEffect(() => {
    if (
      fundingRound &&
      fundingRound.isParticipating &&
      needsPhaseTransition(fundingRound)
    ) {
      dispatch(doPhaseTransition(fundingRound.id))
    }
  }, [
    fundingRound?.phase,
    fundingRound?.publishedAt,
    fundingRound?.submissionsOpenAt,
    fundingRound?.submissionsCloseAt,
    fundingRound?.votingOpensAt,
    fundingRound?.votingClosesAt,
    fundingRound?.isParticipating,
    fundingRound?.id
  ])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    const titleText = fundingRound?.title || t('Funding Round')
    const isPublished = !!fundingRound?.publishedAt
    const titleEl = (
      <span className='flex items-center gap-2 space-between leading-tight'>
        <span className='text-sm font-semibold leading-tight sm:text-base md:text-lg'>
          {titleText}
        </span>
        {canManageRound && (
          <span className={`px-2 py-0.5 rounded-full text-xs ${isPublished ? 'bg-selected text-foreground' : 'bg-foreground/20 text-foreground'}`}>
            {isPublished ? t('Published') : t('Draft')}
          </span>
        )}
      </span>
    )
    setHeaderDetails({ icon: <BadgeDollarSign />, title: titleEl })
  }, [fundingRound?.title, fundingRound?.publishedAt, canManageRound, t])

  if (isLoading) return <Loading />
  if (!isLoading && !fundingRound) return <NotFound />

  return (
    <div className='w-full h-full'>
      <div className='pt-2 sm:pt-4 px-2 sm:px-4 w-full h-full relative flex flex-col'>
        <div className='w-full h-full flex-1 flex flex-col'>
          {(fundingRound.isParticipating || canManageRound) && (
            <div className='flex flex-wrap gap-2 w-full max-w-[800px] mx-auto justify-center items-center bg-darkening/10 rounded-md p-2 mb-2'>
              <Link
                className={`py-1 px-4 rounded-md border-2 !text-foreground border-foreground/20 hover:text-foreground hover:border-foreground/50 transition-all ${currentTab === 'about' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
                to=''
              >
                {t('About')}
              </Link>
              <Link
                className={`py-1 px-3 sm:px-4 rounded-md border-2 !text-foreground border-foreground/20 hover:text-foreground hover:border-foreground/50 transition-all ${currentTab === 'submissions' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
                to='submissions'
              >
                {fundingRound?.phase === 'voting' ? t('Vote') : fundingRound.submissionDescriptorPlural}
                {fundingRound.numSubmissions > 0 && (
                  <span className='ml-2 bg-darkening/20 text-xs font-bold px-2 py-0.5 rounded-full'>
                    {fundingRound.numSubmissions}
                  </span>
                )}
              </Link>
              <Link
                className={`py-1 px-3 sm:px-4 rounded-md border-2 !text-foreground border-foreground/20 hover:text-foreground hover:border-foreground/50 transition-all ${currentTab === 'participants' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
                to='participants'
              >
                {t('Participants')}
                {fundingRound.users?.length > 0 && (
                  <span className='ml-2 bg-darkening/20 text-xs font-bold px-2 py-0.5 rounded-full'>
                    {fundingRound.users.length}
                  </span>
                )}
              </Link>
              <Link
                className={`py-1 px-3 sm:px-4 rounded-md border-2 !text-foreground border-foreground/20 hover:text-foreground hover:border-foreground/50 transition-all ${currentTab === 'chat' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
                to='chat'
              >
                {t('Chat')}
              </Link>
              {canManageRound && (
                <Link
                  className={`py-1 px-3 sm:px-4 rounded-md border-2 !text-foreground border-foreground/20 hover:text-foreground hover:border-foreground/50 transition-all ${currentTab === 'manage' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
                  to='manage'
                >
                  {t('Manage')}
                </Link>
              )}
            </div>)}

          <div className='flex-1 overflow-y-auto w-full h-full' style={{ scrollbarGutter: 'stable both-edges' }}>
            <div className='w-full max-w-[800px] mx-auto h-full'>
              <Routes>
                <Route path='create/*' element={<CreateModal context='groups' />} />
                <Route path=':tab/create/*' element={<CreateModal context='groups' />} />
                <Route path='submissions/*' element={<SubmissionsTab round={fundingRound} canManageRound={canManageRound} canVote={canVote} canSubmit={canSubmit} />} />
                <Route path='participants/*' element={<PeopleTab round={fundingRound} group={currentGroup} canVote={canVote} canSubmit={canSubmit} />} />
                <Route path='chat/*' element={<ChatTab fundingRound={fundingRound} />} />
                {canManageRound && <Route path='edit/*' element={<CreateModal context='groups' editingFundingRound />} />}
                {canManageRound && <Route path='manage/*' element={<ManageTab round={fundingRound} />} />}
                <Route path='*' element={<AboutTab round={fundingRound} canVote={canVote} canSubmit={canSubmit} />} />
              </Routes>
            </div>
          </div>
        </div>
      </div>
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

export default FundingRoundHome
