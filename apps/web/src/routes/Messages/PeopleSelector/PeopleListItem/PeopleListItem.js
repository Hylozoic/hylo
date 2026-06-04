import PropTypes from 'prop-types'
import React, { forwardRef } from 'react'
import { cn } from 'util/index'
import RoundImage from 'components/RoundImage'
import classes from './PeopleListItem.module.scss'

const PeopleListItem = forwardRef(({ active, onClick, onMouseOver, person, className }, ref) => {
  const handleTouchEnd = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (onClick) onClick()
  }

  return (
    <li
      ref={ref}
      className={cn(
        'hover:bg-selected hover:scale-101 flex items-center transition-all bg-transparent hover:cursor-pointer p-2',
        { [classes.active]: active },
        className
      )}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onTouchEnd={handleTouchEnd}
    >
      <div className='min-w-[30px]'><RoundImage url={person.avatarUrl} medium /></div>
      <div className='ml-2 flex gap-2 items-baseline'>
        <span className='text-foreground'>{person.name}</span>
        <span className='text-foreground/50 text-xs'>{person.group}</span>
      </div>
    </li>
  )
})

PeopleListItem.propTypes = {
  active: PropTypes.bool,
  onClick: PropTypes.func,
  onMouseOver: PropTypes.func,
  className: PropTypes.string,
  person: PropTypes.shape({
    id: PropTypes.any,
    name: PropTypes.string,
    avatarUrl: PropTypes.string,
    group: PropTypes.string
  })
}

export default PeopleListItem
