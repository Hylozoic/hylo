import { BadgeDollarSign, Plus, UserPlus, UserMinus } from 'lucide-react'
import React, { useCallback, useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useLocation } from 'react-router-dom'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import fetchGroupFundingRounds, { FETCH_GROUP_FUNDING_ROUNDS } from 'store/actions/fetchGroupFundingRounds'
import getFundingRoundsForGroup from 'store/selectors/getFundingRoundsForGroup'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import isPendingFor from 'store/selectors/isPendingFor'
import { RESP_MANAGE_ROUNDS } from 'store/constants'
import { cn } from 'util/index'
import { joinFundingRound, leaveFundingRound } from './FundingRounds.store'

function FundingRounds () {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const routeParams = useParams()
  const location = useLocation()
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const canManage = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_MANAGE_ROUNDS, groupId: currentGroup?.id }))

  const rounds = useSelector(state => getFundingRoundsForGroup(state, { groupId: currentGroup.id }))
  const roundsToDisplay = useMemo(() => canManage ? rounds : rounds.filter(round => round.publishedAt), [canManage, rounds])

  const pending = useSelector(state => isPendingFor([FETCH_GROUP_FUNDING_ROUNDS], state))

  useEffect(() => {
    dispatch(fetchGroupFundingRounds(currentGroup.id, {}))
  }, [currentGroup.id])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({ icon: <BadgeDollarSign />, title: t('Funding Rounds') })
  }, [])

  const handleJoinRound = useCallback((e, roundId) => {
    e.preventDefault()
    e.stopPropagation()
    dispatch(joinFundingRound(roundId))
  }, [dispatch])

  const handleLeaveRound = useCallback((e, roundId) => {
    e.preventDefault()
    e.stopPropagation()
    dispatch(leaveFundingRound(roundId))
  }, [dispatch])

  return (
    <div className='p-4 max-w-[750px] mx-auto flex flex-col gap-2'>
      {canManage && (
        <div className='text-foreground text-center'>
          <Link to={`${location.pathname}/create/funding-round`} className='flex justify-center items-center gap-1 text-foreground border-2 border-foreground/20 hover:border-foreground/100 rounded-lg py-1 px-2 transition-all hover:scale-105 hover:text-foreground group mb-4 mt-2'>
            <Plus className='w-4 h-4' />
            {t('Add a funding round')}
          </Link>
        </div>
      )}
      {pending
        ? <Loading />
        : roundsToDisplay.length === 0 && (
          <h2 className='text-foreground text-center py-8'>
            {t('This group currently does not have any funding rounds')}
          </h2>
        )}
      {roundsToDisplay.map(fr => (
        <div key={fr.id} className='rounded-xl text-foreground p-4 flex flex-row items-center transition-all bg-card/50 hover:bg-card/100 border-2 border-card/30 shadow-xl hover:shadow-lg relative hover:z-[2] hover:scale-101 duration-400'>
          <Link to={`${location.pathname}/${fr.id}`} className='flex-1 text-foreground'>
            <div className='flex justify-between flex-col items-start space-y-1 pb-1'>
              <div className='text-lg'>{fr.title} <span className={cn('px-2 py-0.5 rounded-full text-xs', fr.publishedAt ? 'bg-selected/50 text-foreground' : 'bg-foreground/20 text-foreground')}>{fr.publishedAt ? t('Published') : t('Draft')}</span></div>
              {fr.description && <div className='text-sm text-foreground/80 line-clamp-2'>{fr.description.replace(/<[^>]*>/g, '')}</div>}
            </div>
          </Link>

          <div className='flex justify-end items-center gap-2'>
            {fr.publishedAt && (
              fr.isParticipating
                ? (
                  <button
                    onClick={(e) => handleLeaveRound(e, fr.id)}
                    className='flex items-center gap-1 px-3 py-1.5 text-sm bg-foreground/10 hover:bg-foreground/20 text-foreground rounded-md transition-all'
                  >
                    <UserMinus className='w-4 h-4' />
                    {t('Leave Round')}
                  </button>
                  )
                : (
                  <button
                    onClick={(e) => handleJoinRound(e, fr.id)}
                    className='flex items-center gap-1 px-3 py-1.5 text-sm border-2 border-selected hover:bg-selected/80 text-foreground rounded-md transition-all'
                  >
                    <UserPlus className='w-4 h-4' />
                    {t('Join Round')}
                  </button>
                  )
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default FundingRounds
