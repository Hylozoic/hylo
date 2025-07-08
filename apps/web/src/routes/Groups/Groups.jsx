import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet'
import { useDispatch, useSelector } from 'react-redux'
import { createSelector } from 'reselect'
import { cn } from 'util/index'
import GroupNetworkMap from 'components/GroupNetworkMap'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { useGetJoinRequests } from 'hooks/useGetJoinRequests'
import useRouteParams from 'hooks/useRouteParams'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getChildGroups, getParentGroups } from 'store/selectors/getGroupRelationships'
import getMyMemberships from 'store/selectors/getMyMemberships'
import { mapNodesAndLinks } from 'util/networkMap'
import GroupCard from 'components/GroupCard'
import { fetchRelatedGroups } from './Groups.store'

import classes from './Groups.module.scss'

function Groups () {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const routeParams = useRouteParams()

  useEffect(() => {
    dispatch(fetchRelatedGroups(routeParams.groupSlug))
  }, [routeParams.groupSlug])

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

export default Groups
