import { Link } from 'react-router-dom'
import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_BANNER,
  DEFAULT_AVATAR,
  accessibilityDescription,
  accessibilityIcon,
  accessibilityString,
  visibilityDescription,
  visibilityIcon,
  visibilityString
} from 'store/models/Group'
import { bgImageStyle, cn } from 'util/index'
import { groupUrl, groupDetailUrl } from 'util/navigation'

import Icon from 'components/Icon'
import RoundImage from 'components/RoundImage'

import classes from './GroupCard.module.scss'

/*
  Each card needs
  - group title
  - group icon
  - group background (tiny, behind the group icon)
  - member sample (for avatars on right )
  - group geography descriptor (indigenous territory, location)

  TODO: Then is contents changed based on group type... perhaps passed in as a Content component
*/

export default function GroupCard ({ group, routeParams }) {
  const { t } = useTranslation()

  if (!group) return null

  return (
    <Link to={group.memberStatus === 'member' ? groupUrl(group.slug) : groupDetailUrl(group.slug, routeParams)}>
      <div className='flex relative rounded-lg p-4 bg-black shadow-xl hover:scale-102 transition-all duration-300'>
        <div className='flex gap-2 relative z-10 w-full justify-between'>
          <div className='flex flex-row gap-2'>
            <RoundImage url={group.avatarUrl || DEFAULT_AVATAR} size='50px' square className='shadow-xl' />
            <div className={cn('flex flex-row gap-2', classes.groupDetails)}>
              <div className='flex flex-col gap-0'>
                <span className={classes.groupName}>{group.name}</span>
                {group.memberCount ? <span className='text-xs text-white/80'>{group.memberCount} {t('Members')}</span> : ''}
              </div>
            </div>
          </div>
          <div className={cn(classes.groupStats)}>
            <div className={cn('flex flex-row gap-2 items-center h-full', classes.membershipStatus)}>
              <div className={classes.groupPrivacy}>
                <Icon name={visibilityIcon(group.visibility)} className={classes.privacyIcon} />
                <div className={classes.privacyTooltip}>
                  <div><strong>{t(visibilityString(group.visibility))}</strong> - {t(visibilityDescription(group.visibility))}</div>
                </div>
              </div>
              <div className={classes.groupPrivacy}>
                <Icon name={accessibilityIcon(group.accessibility)} className={classes.privacyIcon} />
                <div className={classes.privacyTooltip}>
                  <div><strong>{t(accessibilityString(group.accessibility))}</strong> - {t(accessibilityDescription(group.accessibility))}</div>
                </div>
              </div>
              {
                group.memberStatus === 'member'
                  ? <div className={classes.statusTag}><Icon name='Complete' className={classes.memberComplete} /> <b>{t('Member')}</b></div>
                  : group.memberStatus === 'requested'
                    ? <div className={classes.statusTag}><b>{t('Membership Requested')}</b></div>
                    : <div className='focus:text-foreground relative text-base border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground w-full transition-all scale-100 hover:scale-102 opacity-85 hover:opacity-100 flex items-center'><Icon name='CirclePlus' className={classes.joinGroup} /> <b>{t('Join')}</b></div>
              }
            </div>
          </div>
        </div>
        <div style={bgImageStyle(group.bannerUrl || DEFAULT_BANNER)} className='w-full h-full bg-cover bg-center rounded-lg absolute top-0 left-0 opacity-70' />
      </div>
    </Link>
  )
}
