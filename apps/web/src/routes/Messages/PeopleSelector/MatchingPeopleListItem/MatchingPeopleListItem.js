import PropTypes from 'prop-types'
import React from 'react'
import Icon from 'components/Icon'
import classes from './MatchingPeopleListItem.module.scss'

export default function MatchingPeopleListItem ({ avatarUrl, name, onClick }) {
  return (
    <div className='bg-black/20 p-2 rounded hover:scale-105 transition-all flex items-center gap-1'>
      <span className='text-foreground'>{name}</span>
      <span onClick={onClick} role='button' aria-label='Ex' className='group hover:scale-125 transition-all'>
        <Icon name='Ex' className='text-foreground/50 group-hover:text-foreground/100' />
      </span>
    </div>
  )
}

MatchingPeopleListItem.propTypes = {
  avatarUrl: PropTypes.string,
  name: PropTypes.string,
  onClick: PropTypes.func
}
