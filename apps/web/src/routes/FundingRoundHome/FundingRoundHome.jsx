import { capitalize } from 'lodash/fp'
import { BadgeDollarSign, Check, ChevronsRight, DoorOpen, Eye } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CreateModal from 'components/CreateModal'
import Loading from 'components/Loading'
import NotFound from 'components/NotFound'
import PostDialog from 'components/PostDialog'
import Button from 'components/ui/button'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import ChatRoom from 'routes/ChatRoom'
import { FETCH_FUNDING_ROUND, fetchFundingRound, leaveFundingRound, joinFundingRound, updateFundingRound, distributeFundingRoundTokens } from 'store/actions/fundingRoundActions'
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
            <Route path='participants/*' element={<PeopleTab round={fundingRound} />} />
            <Route path='chat/*' element={<ChatTab fundingRound={fundingRound} />} />
            <Route path='edit/*' element={<CreateModal context='groups' editingFundingRound />} />
            <Route path='manage/*' element={<ManageTab round={fundingRound} />} />
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

function ChatTab ({ fundingRound }) {
  return (
    <div className='flex-1 h-full overflow-hidden'>
      <ChatRoom customTopicName={`‡funding_round_${fundingRound.id}`} />
    </div>
  )
}

export default FundingRoundHome
