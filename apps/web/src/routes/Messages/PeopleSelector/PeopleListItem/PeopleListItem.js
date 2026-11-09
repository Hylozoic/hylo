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

  const hasRole = person.hasRequiredRole
  const roleLabel = person.roleLabel

  return (
    <li
      ref={ref}
      className={cn(
        'hover:bg-selected hover:scale-101 flex items-center transition-all bg-transparent hover:cursor-pointer p-2',
        { [classes.active]: active },
        !hasRole && typeof hasRole !== 'undefined' && 'opacity-60',
        className
      )}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onTouchEnd={handleTouchEnd}
    >
      <div className='min-w-[30px]'><RoundImage url={person.avatarUrl} medium /></div>
      <div className='ml-2 flex gap-2 items-baseline flex-1 min-w-0'>
        <span className={cn('truncate', hasRole ? 'text-foreground' : 'text-foreground/70')}>{person.name}</span>
        <span className='text-foreground/50 text-xs shrink-0'>{person.group}</span>
        {typeof roleLabel !== 'undefined' && (
          <span
            className={cn(
              'text-xs shrink-0 ml-auto',
              hasRole ? 'text-green-600/70 dark:text-green-400/70' : 'text-foreground/40'
            )}
          >
            {roleLabel}
          </span>
        )}
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
    group: PropTypes.string,
    hasRequiredRole: PropTypes.bool,
    roleLabel: PropTypes.string
  })
}

export default PeopleListItem
