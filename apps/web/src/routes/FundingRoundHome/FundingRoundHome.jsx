import { capitalize } from 'lodash/fp'
import { BadgeDollarSign } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CreateModal from 'components/CreateModal'
import Loading from 'components/Loading'
import NotFound from 'components/NotFound'
import PostDialog from 'components/PostDialog'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import ChatRoom from 'routes/ChatRoom'
import { FETCH_FUNDING_ROUND, fetchFundingRound, distributeFundingRoundTokens } from 'routes/FundingRounds/FundingRounds.store'
import { RESP_MANAGE_ROUNDS } from 'store/constants'
import getFundingRound from 'store/selectors/getFundingRound'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
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
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const fundingRound = useSelector(state => getFundingRound(state, routeParams.fundingRoundId))
  const isLoading = useSelector(state => state.pending && state.pending[FETCH_FUNDING_ROUND])
  const canManageRound = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_MANAGE_ROUNDS, groupId: currentGroup?.id }))
  const [container, setContainer] = useState(null)

  const currentTab = routeParams.tab || 'about'

  useEffect(() => {
    if (routeParams.fundingRoundId) dispatch(fetchFundingRound(routeParams.fundingRoundId))
  }, [routeParams.fundingRoundId])

  // Trigger token distribution if voting has opened but tokens haven't been distributed yet
  useEffect(() => {
    if (
      fundingRound &&
      fundingRound.votingOpensAt &&
      new Date(fundingRound.votingOpensAt) <= new Date() &&
      !fundingRound.tokensDistributedAt &&
      fundingRound.isParticipating
    ) {
      dispatch(distributeFundingRoundTokens(fundingRound.id))
    }
  }, [fundingRound?.votingOpensAt, fundingRound?.tokensDistributedAt, fundingRound?.isParticipating, fundingRound?.id])

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
          {(fundingRound.isParticipating || canManageRound) && (
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
              {canManageRound && (
                <Link
                  className={`py-1 px-4 rounded-md border-2 !text-foreground border-foreground/20 hover:text-foreground hover:border-foreground transition-all ${currentTab === 'manage' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
                  to='manage'
                >
                  {t('Manage')}
                </Link>
              )}
            </div>)}

          <Routes>
            <Route path='submissions/create/*' element={<CreateModal context='groups' />} />
            <Route path='submissions/post/:postId' element={<PostDialog container={container} />} />
            <Route path='submissions/post/:postId/edit/*' element={<PostDialog container={container} editingPost />} />
            <Route path='submissions/*' element={<SubmissionsTab round={fundingRound} canManageRound={canManageRound} />} />
            <Route path='participants/*' element={<PeopleTab round={fundingRound} group={currentGroup} />} />
            <Route path='chat/*' element={<ChatTab fundingRound={fundingRound} />} />
            <Route path='edit/*' element={<CreateModal context='groups' editingFundingRound />} />
            <Route path='manage/*' element={<ManageTab round={fundingRound} />} />
            <Route path='*' element={<AboutTab round={fundingRound} />} />
          </Routes>
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
