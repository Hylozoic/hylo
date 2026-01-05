import { BadgeDollarSign, Plus, UserPlus, UserMinus } from 'lucide-react'
import React, { useCallback, useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom'
import Loading from 'components/Loading'
import RoundImage from 'components/RoundImage'
import { DateTimeHelpers } from '@hylo/shared'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import fetchGroupFundingRounds, { FETCH_GROUP_FUNDING_ROUNDS } from 'store/actions/fetchGroupFundingRounds'
import getFundingRoundsForGroup from 'store/selectors/getFundingRoundsForGroup'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import isPendingFor from 'store/selectors/isPendingFor'
import { RESP_MANAGE_ROUNDS } from 'store/constants'
import { cn } from 'util/index'
import { joinFundingRound, leaveFundingRound } from './FundingRounds.store'

const getRoundPhase = (round, t) => {
  if (!round?.publishedAt) {
    return {
      key: 'draft',
      label: t('Draft'),
      badgeClass: 'bg-foreground/20 text-foreground'
    }
  }

  const toDate = (value) => (value ? new Date(value) : null)
  const formatDate = (value) => (value ? DateTimeHelpers.formatDatePair({ start: value }) : null)
  const now = new Date()
  const submissionsOpenAt = toDate(round.submissionsOpenAt)
  const submissionsCloseAt = toDate(round.submissionsCloseAt)
  const votingOpensAt = toDate(round.votingOpensAt)
  const votingClosesAt = toDate(round.votingClosesAt)

  if (votingClosesAt && votingClosesAt <= now) {
    const completedDate = formatDate(round.votingClosesAt)
    return {
      key: 'completed',
      label: completedDate ? t('Completed {{date}}', { date: completedDate }) : t('Completed'),
      badgeClass: 'bg-focus/50 text-foreground'
    }
  }

  if (votingOpensAt && votingOpensAt <= now) {
    return {
      key: 'voting',
      label: t('Voting open'),
      badgeClass: 'bg-accent/50 text-foreground'
    }
  }

  if (submissionsCloseAt && submissionsCloseAt <= now) {
    return {
      key: 'discussion',
      label: t('Discussion phase'),
      badgeClass: 'bg-purple-500/50 text-foreground'
    }
  }

  if (submissionsOpenAt && submissionsOpenAt <= now) {
    return {
      key: 'submissions',
      label: t('Submissions open'),
      badgeClass: 'bg-selected/50 text-foreground'
    }
  }

  const scheduledDate = formatDate(round.submissionsOpenAt)
  return {
    key: 'not-begun',
    label: scheduledDate ? t('Starts {{date}}', { date: scheduledDate }) : t('Not yet started'),
    badgeClass: 'bg-foreground/20 text-foreground'
  }
}

function FundingRounds () {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const routeParams = useParams()
  const location = useLocation()
  const navigate = useNavigate()
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

  const handleJoinRound = useCallback(async (e, roundId) => {
    e.preventDefault()
    e.stopPropagation()
    await dispatch(joinFundingRound(roundId))
    navigate(`${location.pathname}/${roundId}/`)
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
          <Link to={`${location.pathname}/create/funding-round`} className='flex justify-center items-center gap-1 text-foreground border-2 border-foreground/20 hover:border-foreground/50 rounded-lg py-1 px-2 transition-all hover:scale-105 hover:text-foreground group mb-4 mt-2'>
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
      {roundsToDisplay.map(fr => {
        const phase = getRoundPhase(fr, t)
        const participants = (() => {
          if (fr.users?.toRefArray) return fr.users.toRefArray()
          if (fr.users?.items) return fr.users.items
          if (Array.isArray(fr.users)) return fr.users
          return []
        })()
        const participantPreview = participants.slice(0, 3)
        const participantCount = typeof fr.numParticipants === 'number' ? fr.numParticipants : participants.length

        return (
          <div key={fr.id} className='rounded-xl text-foreground p-4 flex flex-row items-start transition-all bg-card/50 hover:bg-card/100 border-2 border-card/30 shadow-xl hover:shadow-lg relative hover:z-[2] hover:scale-101 duration-400'>
            <Link to={`${location.pathname}/${fr.id}`} className='flex-1 text-foreground hover:text-foreground'>
              <div className='flex justify-between flex-col items-start space-y-2 pb-1'>
                <div className='flex items-center gap-3 text-xl font-semibold'>
                  <span>{fr.title}</span>
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', phase.badgeClass)}>
                    {phase.label}
                  </span>
                </div>
                {fr.description && <div className='text-sm text-foreground/80 line-clamp-2'>{fr.description.replace(/<[^>]*>/g, '')}</div>}
              </div>
            </Link>

            <div className='flex flex-col items-end gap-3'>
              <Link to={`${location.pathname}/${fr.id}`} className='flex items-center gap-3 px-3 py-1 rounded-full bg-foreground/5 text-xs font-medium text-foreground'>
                {participantPreview.length > 0 && (
                  <div className='flex -space-x-2 items-center'>
                    {participantPreview.map(user => (
                      user.avatarUrl
                        ? (
                          <RoundImage key={user.id} url={user.avatarUrl} small className='border border-background' />
                          )
                        : (
                          <span key={user.id} className='flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground text-[0.65rem] font-semibold border border-background uppercase'>
                            {(user.name || '?').slice(0, 1)}
                          </span>
                          )
                    ))}
                  </div>
                )}
                <div className='flex items-center gap-2'>
                  <span className='whitespace-nowrap'>{participantCount === 1 ? t('participant') : t('participants')}</span>
                  <span className='px-2 py-0.5 rounded-full bg-foreground/20 text-xs font-medium'>{participantCount}</span>
                </div>
              </Link>
              {fr.publishedAt && (
                fr.isParticipating
                  ? (
                    <button
                      onClick={(e) => handleLeaveRound(e, fr.id)}
                      className='flex items-center gap-1 px-3 py-1.5 text-sm border-2 border-foreground/20 bg-transparent hover:bg-foreground/10 text-foreground rounded-md transition-all'
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
                      {fr.phase === 'voting' || fr.phase === 'completed' ? t('View Round') : t('Join Round')}
                    </button>
                    )
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default FundingRounds
