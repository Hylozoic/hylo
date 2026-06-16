import PropTypes from 'prop-types'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { push } from 'redux-first-history'
import { personUrl } from '@hylo/navigation'
import BadgeEmoji from 'components/BadgeEmoji'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import { MapPin, Trash2 } from 'lucide-react'
import { RESP_REMOVE_MEMBERS } from 'store/constants'
import { cn, bgImageStyle } from 'util/index'
import getMe from 'store/selectors/getMe'
import { getResponsibilityTitlesForGroup } from 'store/selectors/getResponsibilitiesForGroup'
import getRolesForGroup from 'store/selectors/getRolesForGroup'

import classes from './Member.module.scss'

const { bool, func, object, string, shape } = PropTypes

function Member ({
  canSeeJoinAnswers,
  className,
  group,
  member,
  removeMember,
  showAnswers,
  square
}) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const currentUserResponsibilities = useSelector(state =>
    getResponsibilityTitlesForGroup(state, { person: currentUser, groupId: group.id }))
  const roles = useSelector(state =>
    getRolesForGroup(state, { person: member.id, groupId: group.id }))

  const goToPerson = useCallback((id, slug) => () => {
    dispatch(push(personUrl(id, slug)))
  }, [dispatch])

  const handleRemoveClick = useCallback((e, id, name) => {
    e.preventDefault()

    if (window.confirm(t('are you sure you want to remove {{name}}?', { name }))) {
      removeMember(id)
    }
  }, [removeMember, t])

  const { id, name, location, tagline, avatarUrl, bannerUrl } = member

  const removeDropdown = currentUserResponsibilities.includes(RESP_REMOVE_MEMBERS) && (
    <Dropdown
      id='member-dropdown'
      alignRight
      className={classes.dropdown}
      toggleChildren={<Icon name='More' />}
      items={[{ icon: <Trash2 className='w-4 h-4 text-destructive' />, label: t('Remove'), onClick: (e) => handleRemoveClick(e, id, name), red: true }]}
    />
  )

  const showJoinAnswersBlock = canSeeJoinAnswers && showAnswers && member.groupJoinQuestionAnswers?.items?.length > 0

  const joinAnswersBlock = showJoinAnswersBlock && (
    <div
      className={cn(
        'flex flex-col gap-2 z-10 relative',
        square && 'flex-1 min-h-0 overflow-y-auto w-full text-left px-0.5'
      )}
    >
      <div className={cn('text-sm font-semibold text-foreground/80 border-t border-foreground/20 pt-2', square && 'text-xs')}>
        {t('Join Question Responses')}
      </div>
      {member.groupJoinQuestionAnswers.items.map((item) => (
        <div key={item.id} className='flex flex-col gap-1'>
          <div className={cn('text-xs font-medium text-foreground/70', square && 'text-[10px]')}>
            {item.question.text}
          </div>
          <div className={cn('text-sm text-foreground/90 pl-2 border-l-2 border-foreground/20', square && 'text-xs pl-1.5')}>
            {item.answer}
          </div>
        </div>
      ))}
    </div>
  )

  // Single-column groups render members as a grid of square cards.
  if (square) {
    return (
      <div className={cn('relative flex flex-col aspect-square bg-card/100 rounded-lg p-3 shadow-lg transition-all hover:scale-102 overflow-hidden min-h-0', className)} data-testid='member-card'>
        <div className='absolute inset-0 w-full h-full bg-cover bg-center z-0 opacity-30' style={bgImageStyle(bannerUrl)} />
        {removeDropdown}
        <div
          onClick={goToPerson(id, group.slug)}
          className={cn(
            'relative z-10 flex flex-col items-center text-center gap-1 cursor-pointer',
            showJoinAnswersBlock ? 'shrink-0 justify-start pt-1' : 'min-h-0 flex-1 justify-center'
          )}
        >
          <div className='w-16 h-16 rounded-full bg-cover bg-center border-2 border-card shadow-md' style={bgImageStyle(avatarUrl)} />
          <div className='flex flex-wrap items-center justify-center gap-1'>
            <span className='font-bold text-sm leading-tight'>{name}</span>
            <div className='text-sm inline-flex gap-1'>
              {roles.map(role => (
                <BadgeEmoji key={role.id + role.common} expanded {...role} responsibilities={role.responsibilities} id={id} />
              ))}
            </div>
          </div>
          {location && <div className='text-xs text-foreground/70 flex items-center gap-1 max-w-full'><MapPin className='w-3 h-3 shrink-0' /> <span className='truncate'>{location}</span></div>}
          {tagline && <div className='text-xs text-foreground/90 line-clamp-2'>{tagline}</div>}
        </div>
        {joinAnswersBlock}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-2 bg-card/100 rounded-lg p-2 shadow-lg hover:bg-card/100 transition-all hover:scale-102 relative overflow-hidden', className)} data-testid='member-card'>
      {removeDropdown}
      <div onClick={goToPerson(id, group.slug)} className='flex flex-row gap-2 z-10 relative cursor-pointer'>
        <div className='min-w-16 min-h-16 max-h-16 rounded-full bg-cover' style={bgImageStyle(avatarUrl)} />
        <div className='flex flex-col gap-0 justify-center'>
          <div className='text-base whitespace-nowrap flex flex-row gap-1 items-center'>
            <span className='font-bold'>{name}</span>
            <div className='text-sm inline-flex gap-1'>
              {roles.map(role => (
                <BadgeEmoji key={role.id + role.common} expanded {...role} responsibilities={role.responsibilities} id={id} />
              ))}
            </div>
          </div>
          {location && <div className='text-xs text-foreground/70 flex items-center gap-1'><MapPin className='w-3 h-3' /> {location}</div>}
          {tagline && <div className='text-base text-foreground/100'>{tagline}</div>}
        </div>
      </div>
      {joinAnswersBlock}
      <div className='absolute inset-0 w-full h-full bg-cover bg-center z-0 opacity-30' style={bgImageStyle(bannerUrl)} />
    </div>
  )
}

Member.propTypes = {
  className: string,
  group: object,
  member: shape({
    id: string,
    name: string,
    location: string,
    tagline: string,
    avatarUrl: string,
    bannerUrl: string
  }).isRequired,
  removeMember: func,
  showAnswers: bool,
  square: bool
}

export default Member
