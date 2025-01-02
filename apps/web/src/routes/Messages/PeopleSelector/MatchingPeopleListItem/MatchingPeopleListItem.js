import PropTypes from 'prop-types'
import React from 'react'
import Icon from 'components/Icon'
import RoundImage from 'components/RoundImage'
import classes from './MatchingPeopleListItem.module.scss'

export default function MatchingPeopleListItem ({ avatarUrl, name, onClick }) {
  return (
    <div className={classes.selectorMatchedItem}>
      <RoundImage url={avatarUrl} small className={classes.avatar} />
      <span className={classes.name}>{name}</span>
      <span onClick={onClick} role='button' aria-label='Ex'>
        <Icon name='Ex' className={classes.deleteMatch} />
      </span>
    </div>
  )
}

MatchingPeopleListItem.propTypes = {
  avatarUrl: PropTypes.string,
  name: PropTypes.string,
  onClick: PropTypes.func
}
