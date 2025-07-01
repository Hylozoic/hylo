import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CirclePlus, CircleCheck } from 'lucide-react'

import { bgImageStyle } from 'util/index'
import { groupUrl, groupDetailUrl } from 'util/navigation'
import Icon from 'components/Icon'
import RoundImage from 'components/RoundImage'
import useRouteParams from 'hooks/useRouteParams'
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
/*
  Each card needs
  - group title
  - group icon
  - group background (tiny, behind the group icon)
  - member sample (for avatars on right )
  - group geography descriptor (indigenous territory, location)

  TODO: Then is contents changed based on group type... perhaps passed in as a Content component
*/
export default function GroupCard ({
  group = {},
  memberships = [],
  className
}) {
  const { t } = useTranslation()
  // XXX: turning this off for now because topics are random and can be weird. Turn back on when groups have their own #tags
  // const topics = group.groupTopics && group.groupTopics.toModelArray()
  const routeParams = useRouteParams()

  const memberStatus = memberships.includes(group.id) ? 'member' : 'not'
  const linkTo = memberStatus === 'member'
    ? groupUrl(group.slug)
    : groupDetailUrl(group.slug, routeParams)

  return (
    <Link to={linkTo}>
      <div className='flex relative rounded-lg p-4 bg-black shadow-xl hover:scale-102 transition-all duration-300'>
        <div className='flex gap-2 relative z-10 w-full justify-between'>
          <div className='flex flex-row gap-2'>
            <RoundImage url={group.avatarUrl || DEFAULT_AVATAR} size='50px' square className='shadow-xl' />
            <div className='flex flex-row gap-2'>
              <div className='flex flex-col gap-0'>
                <span className='text-base font-bold text-white'>{group.name}</span>
                {group.memberCount ? <span className='text-xs text-white/80'>{group.memberCount} {t('Members')}</span> : ''}
              </div>
            </div>
          </div>
          <div className='flex flex-row gap-2 items-center h-full'>
            <div className='relative group'>
              <Icon name={visibilityIcon(group.visibility)} className='w-4 h-4 text-white/80' />
              <div className='absolute hidden group-hover:block right-0 top-full mt-2 p-2 bg-background rounded-md shadow-lg z-20 whitespace-nowrap'>
                <div><strong>{t(visibilityString(group.visibility))}</strong> - {t(visibilityDescription(group.visibility))}</div>
              </div>
            </div>
            <div className='relative group'>
              <Icon name={accessibilityIcon(group.accessibility)} className='w-4 h-4 text-white/80' />
              <div className='absolute hidden group-hover:block right-0 top-full mt-2 p-2 bg-background rounded-md shadow-lg z-20 whitespace-nowrap'>
                <div><strong>{t(accessibilityString(group.accessibility))}</strong> - {t(accessibilityDescription(group.accessibility))}</div>
              </div>
            </div>
            {memberStatus === 'member'
              ? (
                <div className='flex items-center gap-1 px-2 py-1 bg-selected/80 rounded-md text-foreground'>
                  <CircleCheck className='w-4 h-4 text-foreground/100' />
                  <b>{t('Member')}</b>
                </div>)
              : (
                <div className='focus:text-foreground relative text-base border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground transition-all scale-100 hover:scale-102 opacity-85 hover:opacity-100 flex items-center'>
                  <CirclePlus className='w-4 text-foreground h-4 mr-1' />
                  <b>{t('Join')}</b>
                </div>)}
          </div>
        </div>
        <div style={bgImageStyle(group.bannerUrl || DEFAULT_BANNER)} className='w-full h-full bg-cover bg-center rounded-lg absolute top-0 left-0 opacity-70' />
      </div>
    </Link>
  )
}
