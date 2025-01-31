import React from 'react'
import { Link } from 'react-router-dom'
import PropTypes from 'prop-types'
import { isEmpty, filter, get, map } from 'lodash/fp'
import { cn } from 'util/index'
import Icon from 'components/Icon'
import { personUrl } from 'util/navigation'
import { others } from 'store/models/MessageThread'
import classes from '../Messages.module.scss'

const MAX_CHARACTERS = 60

export default class Header extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      showAll: false,
      messageThreadId: null
    }
  }

  toggleShowAll = () => {
    const { showAll } = this.state
    this.setState({
      ...this.state,
      showAll: !showAll
    })
  }

  resetStateWithNewId = (messageThreadId) => {
    this.setState({
      showAll: false,
      messageThreadId
    })
  }

  componentDidUpdate (prevProps) {
    const messageThreadId = get('id', this.props.messageThread)

    if (this.state.messageThreadId !== messageThreadId) {
      this.resetStateWithNewId(messageThreadId)
    }
  }

  getOthers (currentUser, participants) {
    if (!currentUser) return participants

    const id = get('id', currentUser)

    return currentUser && map('name', filter(f => f.id !== id, participants))
  }

  render () {
    const { showAll } = this.state
    const { currentUser, messageThread, pending } = this.props
    const participants = get('participants', messageThread) || []
    const otherParticipants = this.getOthers(currentUser, participants)
    const maxShown = calculateMaxShown(showAll, otherParticipants, MAX_CHARACTERS)
    const { displayNames, andOthers } = generateDisplayNames(maxShown, participants, currentUser)
    const showArrow = !!andOthers

    return (
      <div className={cn(classes.header)} id='thread-header'>
        <Link to='/messages' className={classes.closeThread}>
          <Icon name='ArrowForward' />
        </Link>
        <div className={classes.headerText}>
          {!pending && (
            <>
              <div>{displayNames}</div>
              {andOthers && 'and' && <span className={classes.toggleLink} onClick={this.toggleShowAll}>{andOthers}</span>}
            </>
          )}
        </div>
        {showArrow && !showAll && <Icon name='ArrowDown' className={classes.arrowDown} onClick={this.toggleShowAll} />}
        {showAll && <Icon name='ArrowUp' className={classes.arrowUp} onClick={this.toggleShowAll} />}
      </div>
    )
  }
}

Header.propTypes = {
  messageThread: PropTypes.any
}

export function calculateMaxShown (showAll, otherParticipants, maxCharacters) {
  if (showAll) return otherParticipants.length
  if (!otherParticipants) return 0
  let count = 0
  for (let i = 0; i < otherParticipants.length; i++) {
    count += otherParticipants[i].length
    if (count > maxCharacters) {
      return i
    }
  }
  return otherParticipants.length
}

export const getFormattedLinkToProfile = (user) => {
  return <Link key={user.id} to={personUrl(user.id)}>{user.name}</Link>
}

export function generateDisplayNames (maxShown, participants, currentUser) {
  const formattedCurrentUser = getFormattedLinkToProfile({ id: currentUser.id, name: 'You' })
  const formattedOthers = participants.reduce((result, participant) => {
    if (participant.id !== currentUser.id) {
      result.push(getFormattedLinkToProfile(participant))
    }
    return result
  }, [])
  const formattedDisplayNames = isEmpty(formattedOthers) ? { displayNames: formattedCurrentUser } : formatNames(formattedOthers, maxShown)
  return formattedDisplayNames
}

export function formatNames (otherParticipants, maxShown) {
  let andOthers = null
  const length = otherParticipants.length
  const truncatedNames = (maxShown && maxShown < length)
    ? otherParticipants.slice(0, maxShown).concat([others(length - maxShown)])
    : otherParticipants
  if (maxShown && maxShown < length) andOthers = truncatedNames.pop()
  const formattedTruncatedNames = truncatedNames.map((name, index) => index === truncatedNames.length - 1 ? name : [name, ', '])
  if (andOthers) {
    return { displayNames: formattedTruncatedNames, andOthers: ` ${andOthers}` }
  } else {
    return { displayNames: formattedTruncatedNames }
  }
}
