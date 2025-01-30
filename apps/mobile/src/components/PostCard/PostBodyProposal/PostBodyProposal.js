import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useMutation, useQuery } from 'urql'
import QuorumBar from 'components/QuorumBar/QuorumBar'
import Icon from 'components/Icon'
import Avatar from 'components/Avatar'
import { useTranslation } from 'react-i18next'
import {
  PROPOSAL_STATUS_CASUAL,
  PROPOSAL_STATUS_COMPLETED,
  PROPOSAL_STATUS_DISCUSSION,
  PROPOSAL_STATUS_VOTING,
  VOTING_METHOD_MULTI_UNRESTRICTED,
  VOTING_METHOD_SINGLE
} from 'frontend-shared/presenters/PostPresenter'
import { addProposalVoteMutation, removeProposalVoteMutation, swapProposalVoteMutation } from 'store/actions/proposals'

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
  fulfilledAt,
  proposalStatus,
  proposalOutcome,
  votingMethod,
  proposalOptions,
  isFlagged,
  proposalVotes,
  isAnonymousVote,
  startTime,
  quorum,
  endTime,
  groups,
  id
}) {
  const { t } = useTranslation()

  const [{ fetching: addProposalVoteFetching }, addProposalVote] = useMutation(addProposalVoteMutation)
  const [{ fetching: removeProposalVoteFetching }, removeProposalVote] = useMutation(removeProposalVoteMutation)
  const [{ fetching: swapProposalVoteFetching }, swapProposalVote] = useMutation(swapProposalVoteMutation)

  const isVoting = addProposalVoteFetching || removeProposalVoteFetching || swapProposalVoteFetching
  const proposalOptionsArray = useMemo(() => proposalOptions?.items || [], [proposalOptions])
  const proposalVotesArray = useMemo(() => proposalVotes?.items || [], [proposalVotes])

  const currentUserVotes = useMemo(() => proposalVotesArray.filter(vote => vote?.user?.id === currentUser.id), [proposalVotesArray, currentUser.id])
  const currentUserVotesOptionIds = useMemo(() => currentUserVotes.map(vote => vote.optionId), [currentUserVotes])
  const proposalVoterCount = useMemo(() => calcNumberOfVoters(proposalVotesArray), [proposalVotesArray])
  const numberOfPossibleVoters = useMemo(() => calcNumberOfPossibleVoters(groups), [groups])
  const highestVotedOptions = useMemo(() => calcHighestVotedOptions(proposalVotesArray, proposalOptionsArray), [proposalVotesArray, proposalOptionsArray])

  const votingComplete = proposalStatus === PROPOSAL_STATUS_COMPLETED || fulfilledAt

  const votePrompt = votingMethod === VOTING_METHOD_SINGLE ? t('select one option') : t('select one or more options')

  function handleVote (optionId) {
    if (isVoting) return null
    if (votingMethod === VOTING_METHOD_SINGLE) {
      if (currentUserVotesOptionIds.includes(optionId)) {
        removeProposalVote({ optionId, postId: id })
      } else if (currentUserVotesOptionIds.length === 0) {
        addProposalVote({ optionId, postId: id })
      } else {
        const removeOptionId = currentUserVotesOptionIds[0]
        swapProposalVote({ postId: id, addOptionId: optionId, removeOptionId })
      }
    }
    if (votingMethod === VOTING_METHOD_MULTI_UNRESTRICTED) {
      if (currentUserVotesOptionIds.includes(optionId)) {
        removeProposalVote({ optionId, postId: id })
      } else {
        addProposalVote({ optionId, postId: id })
      }
    }
  }

  return (
    <View style={[styles.proposalBodyContainer, proposalStatus === PROPOSAL_STATUS_DISCUSSION && styles.discussion, proposalStatus === PROPOSAL_STATUS_VOTING && styles.voting, proposalStatus === PROPOSAL_STATUS_CASUAL && styles.casual, votingComplete && styles.completed]}>
      <View style={styles.proposalStatus}>
        {/* {isAnonymousVote && <Icon name='Hidden' styleName='anonymous-voting' dataTip={t('Anonymous voting')} dataTipFor='anon-tt' />} */}
        {isAnonymousVote && <Icon name='Hidden' styleName='anonymous-voting' dataTip='Anonymous voting' dataTipFor='anon-tt' />}
        <Text style={[proposalStatus === PROPOSAL_STATUS_DISCUSSION && styles.discussion, proposalStatus === PROPOSAL_STATUS_VOTING && styles.voting, proposalStatus === PROPOSAL_STATUS_CASUAL && styles.casual, votingComplete && styles.completed]}>
          {proposalStatus === PROPOSAL_STATUS_DISCUSSION && t('Discussion in progress')}
          {votingComplete && t('Voting ended')}
          {proposalStatus === PROPOSAL_STATUS_VOTING && votePrompt}
          {proposalStatus === PROPOSAL_STATUS_CASUAL && !votingComplete && votePrompt}
        </Text>
      </View>
      <View style={styles.proposalTiming}>
        <Text style={[proposalStatus === PROPOSAL_STATUS_DISCUSSION && styles.discussion, proposalStatus === PROPOSAL_STATUS_VOTING && styles.voting, proposalStatus === PROPOSAL_STATUS_CASUAL && styles.casual, votingComplete && styles.completed]}>
          {startTime && proposalStatus !== PROPOSAL_STATUS_COMPLETED && `${new Date(startTime).toLocaleDateString()} - ${new Date(endTime).toLocaleDateString()}`}
          {startTime && votingComplete && `${new Date(endTime).toLocaleDateString()}`}
        </Text>
      </View>
      {!isFlagged && proposalOptionsArray && proposalOptionsArray.map((option, i) => {
        const optionVotes = proposalVotesArray.filter(vote => vote.optionId === option.id)
        const avatarUrls = optionVotes.map(vote => vote.user.avatarUrl)
        const votingPermitted = isVotingOpen(proposalStatus) && !isVoting && !votingComplete
        return (
          <TouchableOpacity key={`${option.id}+${currentUserVotesOptionIds.includes(option.id)}`} style={[styles.proposalOption, votingComplete && styles.completed, proposalStatus === PROPOSAL_STATUS_DISCUSSION && styles.discussion, proposalStatus === PROPOSAL_STATUS_VOTING && styles.voting, proposalStatus === PROPOSAL_STATUS_CASUAL && styles.casual, currentUserVotesOptionIds.includes(option.id) && styles.selected, votingComplete && styles.completed, votingComplete && highestVotedOptions.includes(option.id) && styles.highestVote]} onPress={votingPermitted ? () => handleVote(option.id) : () => {}}>
            <View style={styles.proposalOptionTextContainer}>
              <View style={styles.proposalOptionEmoji}>
                <Text>
                  {option.emoji}
                </Text>
              </View>
              <View style={styles.proposalOptionText}>
                <Text style={[votingComplete && styles.completed, proposalStatus === PROPOSAL_STATUS_DISCUSSION && styles.discussion, proposalStatus === PROPOSAL_STATUS_VOTING && styles.voting, proposalStatus === PROPOSAL_STATUS_CASUAL && styles.casual, votingComplete && styles.completed, currentUserVotesOptionIds.includes(option.id) && styles.selected, votingComplete && highestVotedOptions.includes(option.id) && styles.highestVote]}>
                  {option.text}
                </Text>
              </View>
            </View>
            {/* I'm not very excited by having to put an empty view but the flex/overflow rules here don't seem to be respected like they are in EVO */}
            <View style={{ flexGrow: 2, flexShrink: 0 }} />
            <View style={styles.proposalOptionVotesContainer}>
              <View style={styles.proposalOptionVoteCount}>
                {(!isAnonymousVote || votingComplete) &&
                  <Text style={[votingComplete && styles.completed, proposalStatus === PROPOSAL_STATUS_DISCUSSION && styles.discussion, proposalStatus === PROPOSAL_STATUS_VOTING && styles.voting, proposalStatus === PROPOSAL_STATUS_CASUAL && styles.casual, votingComplete && styles.completed, currentUserVotesOptionIds.includes(option.id) && styles.selected, votingComplete && highestVotedOptions.includes(option.id) && styles.highestVote]}>
                    {optionVotes.length}
                  </Text>}
              </View>
              {!isAnonymousVote &&
                <View style={styles.proposalOptionVoteAvatars}>
                  {avatarUrls.slice(0, 3).map((avatarUrl, index) => {
                    return (
                      <Avatar
                        key={index}
                        avatarUrl={avatarUrl}
                        size='small'
                        hasBorder
                        hasOverlap={index > 0}
                        zIndex={3 - index}
                      />
                    )
                  })}
                </View>}
            </View>
          </TouchableOpacity>
        )
      })}
      {!!(quorum && quorum > 0) && (
        <QuorumBar totalVoters={numberOfPossibleVoters} quorum={quorum} actualVoters={proposalVoterCount} proposalStatus={proposalStatus} />
      )}
      {!!(proposalOutcome && fulfilledAt) && (
        <Text style={styles.proposalOutcome}>{t('Outcome')}: {proposalOutcome}</Text>
      )}
    </View>
  )
}

const styles = {
  casual: {
    borderColor: '#0DC39F',
    color: '#0DC39F'
  },
  voting: {
    borderColor: '#0DC39F',
    color: '#0DC39F'
  },
  completed: {
    borderColor: '#C0C5CD',
    color: '#C0C5CD',
  },
  selected: {
    backgroundColor: '#0DC39F',
    color: 'white'
  },
  highestVote: {
    backgroundColor: '#0074D8',
    color: 'white',
  },
  people: {
    whiteSpace: 'nowrap'
  },
  proposalBodyContainer: {
    borderStyle: 'dashed',
    position: 'relative',
    borderWidth: 1,
    borderRadius: 10,
    display: 'flex',
    margin: 8,
    flexDirection: 'column',
    gap: 8,
    padding: 12,
    paddingTop: 24
  },
  proposalStatus: {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    top: -16,
    left: 12,
    padding: 6,
    backgroundColor: 'white'
  },
  proposalTiming: {
    position: 'absolute',
    top: -16,
    right: 6,
    padding: 6,
    backgroundColor: 'white'
  },
  proposalOption: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderRadius: 10,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative'
  },
  proposalOutcome: {
    padding: 6,
    backgroundColor: '#F2F2F2',
    color: '#0074D8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(213, 236, 250, 1)',
    borderRadius: 5
  },
  discussion: {
    borderColor: '#C0C5CD',
    color: '#C0C5CD'
  },
  proposalOptionEmoji: {
    fontSize: 24
  },
  proposalOptionTextContainer: {
    height: 30,
    display: 'flex',
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    margin: 5,
    fontSize: 18,
    flexGrow: 1,
    flexShrink: 1
  },
  proposalOptionVoteCount: {
    fontSize: 12,
    position: 'relative'
  },
  proposalOptionVoteAvatars: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative'
  },
  proposalOptionVotesContainer: {
    height: 30,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    margin: 5,
    flexGrow: 1
  }
}
