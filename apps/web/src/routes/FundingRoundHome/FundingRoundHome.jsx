import { BadgeDollarSign } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import getFundingRound from 'store/selectors/getFundingRound'
import { FETCH_FUNDING_ROUND, fetchFundingRound } from 'store/actions/fundingRoundActions'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { RESP_MANAGE_ROUNDS } from 'store/constants'
import useRouteParams from 'hooks/useRouteParams'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import changeQuerystringParam from 'store/actions/changeQuerystringParam'
import Loading from 'components/Loading'
import HyloHTML from 'components/HyloHTML'

function FundingRoundHome () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const location = useLocation()
  const routeParams = useRouteParams()
  const queryParams = useMemo(() => getQuerystringParam(['tab'], location), [location])
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const fundingRound = useSelector(state => getFundingRound(state, routeParams.roundId))
  const isLoading = useSelector(state => state.pending && state.pending[FETCH_FUNDING_ROUND])
  const canEdit = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_MANAGE_ROUNDS, groupId: currentGroup?.id }))
  const [currentTab, setCurrentTab] = useState(queryParams.tab || 'about')

  const changeTab = useCallback((tab) => {
    setCurrentTab(tab)
    dispatch(changeQuerystringParam(location, 'tab', tab, null, true))
  }, [location])

  useEffect(() => {
    if (!fundingRound && routeParams.roundId) dispatch(fetchFundingRound(routeParams.roundId))
  }, [routeParams.roundId])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({ icon: <BadgeDollarSign />, title: fundingRound?.title || t('Funding Round') })
  }, [fundingRound?.title])

  if (isLoading) return <Loading />
  if (!fundingRound) return <Loading />

  return (
    <div className='w-full h-full'>
      <div className='pt-4 px-4 w-full h-full relative overflow-y-auto flex flex-col'>
        <div className='w-full max-w-[750px] mx-auto flex-1'>
          <div className='flex gap-2 w-full justify-center items-center bg-black/20 rounded-md p-2'>
            <button
              className={`py-1 px-4 rounded-md border-2 border-foreground/20 hover:border-foreground/100 transition-all ${currentTab === 'about' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
              onClick={() => changeTab('about')}
            >
              {t('About')}
            </button>
            <button
              className={`py-1 px-4 rounded-md border-2 border-foreground/20 hover:border-foreground/100 transition-all ${currentTab === 'submissions' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
              onClick={() => changeTab('submissions')}
            >
              {t('Submissions')}
            </button>
            <button
              className={`py-1 px-4 rounded-md border-2 border-foreground/20 hover:border-foreground/100 transition-all ${currentTab === 'chat' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
              onClick={() => changeTab('chat')}
            >
              {t('Chat')}
            </button>
            {canEdit && (
              <button
                className={`py-1 px-4 rounded-md border-2 border-foreground/20 hover:border-foreground/100 transition-all ${currentTab === 'edit' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
                onClick={() => changeTab('edit')}
              >
                {t('Edit')}
              </button>
            )}
          </div>

          {currentTab === 'about' && (
            <AboutTab round={fundingRound} />
          )}

          {currentTab === 'submissions' && (
            <SubmissionsTab />
          )}

          {currentTab === 'chat' && (
            <ChatTab />
          )}

          {canEdit && currentTab === 'edit' && (
            <EditTab />
          )}
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
    <div className='max-w-[750px] mx-auto p-4 flex flex-col gap-3'>
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

function SubmissionsTab () {
  const { t } = useTranslation()
  return (
    <div className='max-w-[750px] mx-auto p-4'>
      <div className='text-foreground/70'>{t('No submissions yet')}</div>
    </div>
  )
}

function ChatTab () {
  const { t } = useTranslation()
  return (
    <div className='max-w-[750px] mx-auto p-4'>
      <div className='text-foreground/70'>{t('Use the group chat to coordinate')}</div>
    </div>
  )
}

function EditTab () {
  const { t } = useTranslation()
  return (
    <div className='max-w-[750px] mx-auto p-4'>
      <div className='text-foreground/70'>{t('Editing coming soon')}</div>
    </div>
  )
}

export default FundingRoundHome
