import { Link } from 'react-router-dom'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet'
import { useSelector } from 'react-redux'
import { createSelector } from 'reselect'
import { bgImageStyle, cn } from 'util/index'
import Icon from 'components/Icon'
import RoundImage from 'components/RoundImage'
import GroupNetworkMap from 'components/GroupNetworkMap'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { useGetJoinRequests } from 'hooks/useGetJoinRequests'
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
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getChildGroups, getParentGroups } from 'store/selectors/getGroupRelationships'
import getMyMemberships from 'store/selectors/getMyMemberships'
import { groupUrl, groupDetailUrl } from 'util/navigation'
import { mapNodesAndLinks } from 'util/networkMap'

import classes from './Groups.module.scss'

function Groups () {
  const { t } = useTranslation()
  const routeParams = useRouteParams()

  const group = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const memberships = useSelector(getMyMemberships)
  const joinRequests = useGetJoinRequests()

  const childGroups = useSelector(
    createSelector(
      state => getChildGroups(state, group),
      (childGroups) => childGroups.map(g => ({
        ...g.ref,
        memberStatus: memberships.find(m => m.group.id === g.id) ? 'member' : joinRequests.find(jr => jr.group.id === g.id) ? 'requested' : 'not'
      }))
    )
  )

  const parentGroups = useSelector(
    createSelector(
      state => getParentGroups(state, group),
      (parentGroups) => parentGroups.map(g => ({
        ...g.ref,
        memberStatus: memberships.find(m => m.group.id === g.id) ? 'member' : joinRequests.find(jr => jr.group.id === g.id) ? 'requested' : 'not'
      }))
    )
  )

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('Groups'),
      icon: 'Groups',
      search: true
    })
  }, [])

  const networkData = mapNodesAndLinks(parentGroups, childGroups, group)
  const groupRelationshipCount = childGroups.length + parentGroups.length

  return (
    <div className='w-full pt-8 pb-8 overflow-y-auto h-full'>
      <Helmet>
        <title>Groups | {group ? `${group.name} | ` : ''}Hylo</title>
      </Helmet>

      {!groupRelationshipCount && (
        <div className='w-full max-w-[750px] mx-auto'>
          <div className='text-foreground border-2 mt-6 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 text-foreground background-black/10 rounded-lg border-dashed relative mb-4 hover:border-t-foreground/100 hover:border-x-foreground/90 transition-all hover:border-b-foreground/80 flex items-center gap-2 flex-col'>
            <div className='text-center'>{t('Your group is not connected to any other groups yet.')}</div>
          </div>
        </div>
      )}

      <div className='w-full max-w-[750px] mx-auto'>
        {groupRelationshipCount > 1 &&
          <div className={cn('bg-card rounded-lg relative', classes.networkMap)}>
            <GroupNetworkMap networkData={networkData} />
          </div>}

        {parentGroups.length > 0 && (
          <div className='text-foreground border-2 mt-6 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 text-foreground background-black/10 rounded-lg border-dashed relative mb-4 hover:border-t-foreground/100 hover:border-x-foreground/90 transition-all hover:border-b-foreground/80 flex items-center gap-2 flex-col'>
            <div className='text-center'>
              {parentGroups.length === 1 ? <h3 className='text-foreground text-lg font-bold'>{t('{{group.name}} is a part of 1 Group', { group })}</h3> : ''}
              {parentGroups.length > 1 ? <h3 className='text-foreground text-lg font-bold'>{t('{{group.name}} is a part of {{parentGroups.length}} Groups', { group, parentGroups })}</h3> : ''}
            </div>
            <GroupsList
              groups={parentGroups}
              routeParams={routeParams}
            />
          </div>
        )}

        {childGroups.length > 0 && (
          <div className='text-foreground border-2 mt-6 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 text-foreground background-black/10 rounded-lg border-dashed relative mb-4 hover:border-t-foreground/100 hover:border-x-foreground/90 transition-all hover:border-b-foreground/80 flex items-center gap-2 flex-col'>
            <div className='text-center'>
              {childGroups.length === 1 ? <h3 className='text-foreground text-lg font-bold'>{t('1 Group is a part of {{group.name}}', { group })}</h3> : ''}
              {childGroups.length > 1 ? <h3 className='text-foreground text-lg font-bold'>{t('{{childGroups.length}} groups are a part of {{group.name}}', { childGroups, group })}</h3> : ''}
            </div>
            <GroupsList
              groups={childGroups}
              routeParams={routeParams}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function GroupsList ({ groups, routeParams }) {
  return (
    <div className='flex flex-col gap-4 w-full'>
      {groups.map(c => <GroupCard group={c} key={c.id} routeParams={routeParams} />)}
    </div>
  )
}

export function GroupCard ({ group, routeParams }) {
  const { t } = useTranslation()
  return (
    <Link to={group.memberStatus === 'member' ? groupUrl(group.slug) : groupDetailUrl(group.slug, routeParams)}>
      <div className='flex relative rounded-lg p-4 bg-black shadow-xl hover:scale-105 transition-all duration-300'>
        <div className='flex gap-2 relative z-10 w-full justify-between'>
          <div className='flex flex-row gap-2'>
            <RoundImage url={group.avatarUrl || DEFAULT_AVATAR} size='50px' square className='shadow-xl' />
            <div className={cn('flex flex-row gap-2', classes.groupDetails)}>
              <div className='flex flex-col gap-0'>
                <span className={classes.groupName}>{group.name}</span>
                {group.memberCount ? <span className='text-xs text-foreground/50'>{group.memberCount} {t('Members')}</span> : ''}
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
                    : <div className='focus:text-foreground relative text-base border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground w-full transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 flex items-center'><Icon name='CirclePlus' className={classes.joinGroup} /> <b>{t('Join')}</b></div>
              }
            </div>
          </div>
        </div>
        <div style={bgImageStyle(group.bannerUrl || DEFAULT_BANNER)} className='w-full h-full bg-cover bg-center rounded-lg absolute top-0 left-0 opacity-70' />
      </div>
    </Link>
  )
}
export default Groups
