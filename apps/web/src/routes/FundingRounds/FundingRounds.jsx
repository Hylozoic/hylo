import { BadgeDollarSign, Plus } from 'lucide-react'
import React, { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import fetchGroupFundingRounds, { FETCH_GROUP_FUNDING_ROUNDS } from 'store/actions/fetchGroupFundingRounds'
import getFundingRoundsForGroup from 'store/selectors/getFundingRoundsForGroup'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import isPendingFor from 'store/selectors/isPendingFor'
import { RESP_MANAGE_ROUNDS } from 'store/constants'

function FundingRounds () {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const routeParams = useParams()
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
        <Link key={fr.id} to={`${location.pathname}/${fr.id}`} className='block border border-foreground/20 rounded-lg p-3 hover:border-foreground/100 transition-all'>
          <div className='text-lg'>{fr.title}</div>
          {fr.description && <div className='text-sm text-foreground/80 line-clamp-2'>{fr.description}</div>}
        </Link>
      ))}
    </div>
  )
}

export default FundingRounds
