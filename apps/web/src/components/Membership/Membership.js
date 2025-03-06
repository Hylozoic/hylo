import { cn } from 'util/index'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { DEFAULT_AVATAR } from 'store/models/Group'
import getRolesForGroup from 'store/selectors/getRolesForGroup'
import { groupUrl } from 'util/navigation'
import BadgeEmoji from 'components/BadgeEmoji'
import Button from 'components/Button'
import RoundImage from 'components/RoundImage'
import classes from './Membership.module.scss'

export default function Membership ({ membership, index, archive, rowStyle }) {
  const { group, person } = membership
  const { t } = useTranslation()

  // Pass in person.id here since the person loaded through the membership won't have membershipCommonRoles associated
  const roles = useSelector(state => getRolesForGroup(state, { person: person.id, groupId: group.id }))

  const leave = () => {
    if (window.confirm(t('Are you sure you want to leave {{groupName}}?', { groupName: group.name }))) {
      archive(group)
    }
  }

  return (
    <div className={cn({ [classes.even]: index % 2 === 0, [classes.odd]: index % 2 !== 0, [classes.rowStyle]: rowStyle })}>
      <button className='rounded-lg bg-black/10 flex transition-all text-foreground items-center align-center px-5 h-[40px] opacity-80 hover:opacity-100 scale-100 hover:scale-105 hover:bg-black/20'>
        <Link to={groupUrl(group.slug)} className='text-foreground flex space-x-2'>
          <RoundImage url={group.avatarUrl || DEFAULT_AVATAR} small />
          <div>{group.name}</div>
        </Link>

        <div className={cn('ml-2 opacity-20', classes.roles)}>
          {roles.map(role => (
            <BadgeEmoji key={role.id + role.common} expanded {...role} responsibilities={role.responsibilities} id={membership.id} />
          ))}
        </div>
      </button>
      {archive && <span onClick={leave} className={classes.leaveButton}>{t('Leave')}</span>}
    </div>
  )
}
