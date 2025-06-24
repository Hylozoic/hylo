import { cn } from 'util/index'
import React, { useMemo } from 'react'
import { throttle } from 'lodash/fp'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Tooltip } from 'react-tooltip'
import { PROPOSAL_STATUS_CASUAL, PROPOSAL_STATUS_COMPLETED, PROPOSAL_STATUS_DISCUSSION, PROPOSAL_STATUS_VOTING, VOTING_METHOD_MULTI_UNRESTRICTED, VOTING_METHOD_SINGLE } from 'store/models/Post'
import {
  addProposalVote,
  removeProposalVote,
  swapProposalVote
} from '../../../store/actions/proposals'
import QuorumBar from 'components/QuorumBar'
import classes from './PostBodyProposal.module.scss'
import RoundImageRow from 'components/RoundImageRow'
import Icon from 'components/Icon/Icon'

const calcNumberOfVoters = (votes) => {
  return votes.reduce((acc, vote) => {
    if (!acc.includes(vote.user.id)) {
      acc.push(vote.user.id)
    }
    return acc
  }, []).length
}

const calcNumberOfPossibleVoters = (groups) => {
  return groups.reduce((acc, group) => {
    return acc + group.memberCount
  }, 0)
}

const calcHighestVotedOptions = (votes) => {
  const tally = {}

  votes.forEach(vote => {
    if (tally[vote.optionId]) {
      tally[vote.optionId]++
    } else {
      tally[vote.optionId] = 1
    }
  })

  let maxTally = 0
  for (const optionId in tally) {
    if (tally[optionId] > maxTally) {
      maxTally = tally[optionId]
    }
  }

  const highestVotedOptions = []
  for (const optionId in tally) {
    if (tally[optionId] === maxTally) {
      highestVotedOptions.push(optionId)
    }
  }

  return highestVotedOptions
}

const isVotingOpen = (proposalStatus) => proposalStatus === PROPOSAL_STATUS_VOTING || proposalStatus === PROPOSAL_STATUS_CASUAL

export default function PostBodyProposal ({
  currentUser,
  isFlagged,
  onAddProposalVote = () => {},
  onRemoveProposalVote = () => {},
  onSwapProposalVote = () => {},
  post
}) {
  const { id, groups, proposalStatus, votingMethod, proposalOptions, proposalVotes, isAnonymousVote, proposalOutcome, startTime, quorum, endTime, fulfilledAt } = post
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const proposalOptionsArray = useMemo(() => proposalOptions || [], [proposalOptions])
  const proposalVotesArray = useMemo(() => proposalVotes?.items || [], [proposalVotes])

  const currentUserVotes = useMemo(() => proposalVotesArray.filter(vote => vote?.user?.id === currentUser?.id), [proposalVotesArray, currentUser?.id])
  const currentUserVotesOptionIds = useMemo(() => currentUserVotes.map(vote => vote.optionId), [currentUserVotes])
  const proposalVoterCount = useMemo(() => calcNumberOfVoters(proposalVotesArray), [proposalVotesArray])
  const numberOfPossibleVoters = useMemo(() => calcNumberOfPossibleVoters(groups), [groups])
  const highestVotedOptions = useMemo(() => calcHighestVotedOptions(proposalVotesArray, proposalOptionsArray), [proposalVotesArray, proposalOptionsArray])

  const votingComplete = proposalStatus === PROPOSAL_STATUS_COMPLETED || fulfilledAt

  function handleVote (optionId) {
    if (votingMethod === VOTING_METHOD_SINGLE) {
      if (currentUserVotesOptionIds.includes(optionId)) {
        dispatch(removeProposalVote({ optionId, postId: id }))
        onRemoveProposalVote({ post, optionId })
      } else if (currentUserVotesOptionIds.length === 0) {
        dispatch(addProposalVote({ optionId, postId: id }))
        onAddProposalVote({ post, optionId })
      } else {
        const removeOptionId = currentUserVotesOptionIds[0]
        dispatch(swapProposalVote({ postId: id, addOptionId: optionId, removeOptionId }))
        onSwapProposalVote({ post, addOptionId: optionId, removeOptionId })
      }
    }
    if (votingMethod === VOTING_METHOD_MULTI_UNRESTRICTED) {
      if (currentUserVotesOptionIds.includes(optionId)) {
        dispatch(removeProposalVote({ optionId, postId: id }))
        onRemoveProposalVote({ post, optionId })
      } else {
        dispatch(addProposalVote({ optionId, postId: id }))
        onAddProposalVote({ post, optionId })
      }
    }
  }

  const handleVoteThrottled = throttle(200, handleVote)

  const votePrompt = votingMethod === VOTING_METHOD_SINGLE ? t('select one') : t('select one or more options')

  return (
    <div className={cn('group border-2 mt-6 mx-2 p-2 sm:p-4 text-foreground background-black/10 rounded-lg border-dashed relative mb-4 transition-all flex flex-col gap-2', {
      'border-t-focus/30 border-x-focus/20 border-b-focus/10  hover:border-t-focus/100 hover:border-x-focus/90 hover:border-b-focus/80': proposalStatus === PROPOSAL_STATUS_DISCUSSION,
      'border-t-selected/30 border-x-selected/20 border-b-selected/10 hover:border-t-selected/100 hover:border-x-selected/90 hover:border-b-selected/80': proposalStatus === PROPOSAL_STATUS_VOTING || proposalStatus === PROPOSAL_STATUS_CASUAL,
      'border-t-foreground/30 border-x-foreground/20 border-b-foreground/10': votingComplete,
      'blur-sm pointer-events-none': isFlagged
    })}
    >
      <div className={cn('text-shadow-lg rounded-lg px-2 absolute -top-3 text-sm font-bold text-foreground left-1/2 -translate-x-1/2', {
        'bg-focus/90': proposalStatus === PROPOSAL_STATUS_DISCUSSION,
        'bg-selected/90': proposalStatus === PROPOSAL_STATUS_VOTING || proposalStatus === PROPOSAL_STATUS_CASUAL,
        'bg-foreground/30': votingComplete
      })}
      >
        {isAnonymousVote && <Icon name='Hidden' className={classes.anonymousVoting} tooltipContent={t('Anonymous voting')} tooltipId={`anon-tt-${id}`} />}
        {proposalStatus === PROPOSAL_STATUS_DISCUSSION && t('Discussion in progress')}
        {proposalStatus === PROPOSAL_STATUS_VOTING && t('Voting open') + ', ' + votePrompt}
        {votingComplete && t('Voting ended')}
        {proposalStatus === PROPOSAL_STATUS_CASUAL && !votingComplete && t('Voting open') + ', ' + votePrompt}

        <div className='inline-flex items-center gap-1 text-xs pl-1 font-normal text-foreground/70'>
          {startTime && proposalStatus !== PROPOSAL_STATUS_COMPLETED && `• ${new Date(startTime).toLocaleDateString()} - ${new Date(endTime).toLocaleDateString()}`}
          {startTime && votingComplete && `${new Date(endTime).toLocaleDateString()}`}
        </div>
      </div>
      <Tooltip
        backgroundColor='rgba(35, 65, 91, 1.0)'
        effect='solid'
        delayShow={0}
        id={`anon-tt-${id}`}
      />
      {proposalOptionsArray && proposalOptionsArray.map((option, i) => {
        const optionVotes = proposalVotesArray.filter(vote => vote.optionId === option.id)
        const voterNames = isAnonymousVote ? [] : optionVotes.map(vote => vote.user.name)
        const avatarUrls = optionVotes.map(vote => vote.user.avatarUrl)
        return (
          <div
            key={`${option.id}+${currentUserVotesOptionIds.includes(option.id)}`}
            className={cn('border-2 items-center border-foreground/20 justify-between rounded-lg p-2 flex hover:bg-selected/50 text-foreground transition-all hover:border-foreground/50', {
              'bg-selected text-foreground border-foreground/50 hover:bg-selected/100': currentUserVotesOptionIds.includes(option.id),
              'hover:bg-transparent hover:border-foreground/20': votingComplete,
              'bg-success/50 text-success': (votingComplete || proposalOutcome) && highestVotedOptions.includes(option.id)
            })}
            onClick={isVotingOpen(proposalStatus) && !votingComplete ? () => handleVoteThrottled(option.id) : () => {}}
          >
            <div className='flex items-center gap-2'>
              <div>
                {option.emoji}
              </div>
              <div>
                {option.text}
              </div>
            </div>
            <div className='flex items-center h-8 gap-0 rounded-sm bg-black/20 p-1 px-2' data-tooltip-html={voterNames.length > 0 ? `<pre>${voterNames.join('\r\n')}</pre>` : ''} data-tooltip-id={`voters-tt-${id}`}>
              {(!isAnonymousVote || votingComplete) &&
                <div className='text-sm'>
                  {optionVotes.length}
                </div>}
              {!isAnonymousVote &&
                <div>
                  <RoundImageRow imageUrls={avatarUrls.slice(0, 3)} className='scale-75' />
                </div>}
            </div>
          </div>
        )
      }
      )}
      <Tooltip
        backgroundColor='rgba(35, 65, 91, 1.0)'
        effect='solid'
        delayShow={0}
        id={`voters-tt-${id}`}
      />
      {!!quorum && (quorum > 0) && <QuorumBar totalVoters={numberOfPossibleVoters} quorum={quorum} actualVoters={proposalVoterCount} proposalStatus={proposalStatus} />}
      {!!proposalOutcome && fulfilledAt && <div className={classes.proposalOutcome}>  {t('Outcome')}: {proposalOutcome}</div>}
    </div>
  )
}
