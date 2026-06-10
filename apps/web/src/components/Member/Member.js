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

const { bool, object, string, shape } = PropTypes

function Member ({
  canSeeJoinAnswers,
  className,
  group,
  member,
  removeMember,
  showAnswers
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

  return (
    <div className={cn('flex flex-col gap-2 bg-card/100 rounded-lg p-2 shadow-lg hover:bg-card/100 transition-all hover:scale-102 relative overflow-hidden', className)} data-testid='member-card'>
      {(currentUserResponsibilities.includes(RESP_REMOVE_MEMBERS)) &&
        <Dropdown
          id='member-dropdown'
          alignRight
          className={classes.dropdown}
          toggleChildren={<Icon name='More' />}
          items={[{ icon: <Trash2 className='w-4 h-4 text-destructive' />, label: t('Remove'), onClick: (e) => handleRemoveClick(e, id, name), red: true }]}
        />}
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
      {canSeeJoinAnswers && showAnswers && member.groupJoinQuestionAnswers?.items?.length > 0 && (
        <div className='flex flex-col gap-2 z-10 relative'>
          <div className='text-sm font-semibold text-foreground/80 border-t border-foreground/20 pt-2'>
            {t('Join Question Responses')}
          </div>
          {member.groupJoinQuestionAnswers.items.map((item) => (
            <div key={item.id} className='flex flex-col gap-1'>
              <div className='text-xs font-medium text-foreground/70'>
                {item.question.text}
              </div>
              <div className='text-sm text-foreground/90 pl-2 border-l-2 border-foreground/20'>
                {item.answer}
              </div>
            </div>
          ))}
        </div>
      )}
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
  removeMember: PropTypes.func,
  showAnswers: bool
}

export default Member
