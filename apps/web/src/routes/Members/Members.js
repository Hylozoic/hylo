import { debounce, get } from 'lodash/fp'
import React, { useEffect, useLayoutEffect, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet'
import { Link, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { isSystemGroupRole, sortCustomGroupRoles, sortSystemGroupRoles } from '@hylo/hooks/groupRoleHelpers'
import Button from 'components/Button'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import Member from 'components/Member'
import ScrollListener from 'components/ScrollListener'
import SwitchStyled from 'components/SwitchStyled'
import { MembersBootstrapSkeleton } from 'components/Skeleton/RouteBootstrapPlaceholders'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { useEffectiveGroupSlug } from 'contexts/SpaceGroupContext'
import { RESP_ADD_MEMBERS, RESP_ADMINISTRATION, RESP_MANAGE_SPACES } from 'store/constants'
import { groupUrl } from '@hylo/navigation'
import { FETCH_MEMBERS, fetchMembers, getMembers, getHasMoreMembers, getHasFetchedMembers, getMemberQueryProps, removeMember } from './Members.store'
import { fetchTrack } from 'store/actions/trackActions'
import { fetchFundingRound } from 'routes/FundingRounds/FundingRounds.store'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import getRolesForGroup from 'store/selectors/getRolesForGroup'
import getTrack from 'store/selectors/getTrack'
import getFundingRound from 'store/selectors/getFundingRound'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import changeQuerystringParam from 'store/actions/changeQuerystringParam'
import getResponsibilitiesForGroup from 'store/selectors/getResponsibilitiesForGroup'
import { isOneColumnLayout as resolveIsOneColumnLayout } from 'util/navigationLayout'
import { CENTER_COLUMN_ID } from 'util/scrolling'
import orm from 'store/models'

import classes from './Members.module.scss'

const defaultSortBy = 'name'
// TODO: should be by responsibility, not role
const TRACK_COMPLETION_VISIBLE_ROLES = ['Moderator', 'Host']

function Members (props) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const location = useLocation()

  const context = props.context
  const slug = useEffectiveGroupSlug()

  // State selectors
  const group = useSelector(state => getGroupForSlug(state, slug))
  const currentUser = useSelector(getMe)
  const sortKeys = sortKeysFactory()
  const sortByParam = getQuerystringParam('s', location) || defaultSortBy
  const sortBy = sortKeys[sortByParam] ? sortByParam : defaultSortBy
  const search = getQuerystringParam('q', location)
  const groupRoleId = getQuerystringParam('r', location) || null
  const memberCount = useSelector(state => get('memberCount', group))
  const memberQueryProps = useMemo(
    () => getMemberQueryProps({ slug, search, sortBy, groupRoleId }),
    [slug, search, sortBy, groupRoleId]
  )
  const members = useSelector(state => getMembers(state, memberQueryProps))
  const hasMore = useSelector(state => getHasMoreMembers(state, memberQueryProps))
  const hasFetched = useSelector(state => getHasFetchedMembers(state, memberQueryProps))
  const pending = useSelector(state => state.pending[FETCH_MEMBERS])
  const isLoading = !hasFetched || (pending && members.length === 0)
  const myResponsibilities = useSelector(state => getResponsibilitiesForGroup(state, { groupId: group?.id }))
  const myResponsibilityTitles = useMemo(() => myResponsibilities.map(r => r.title), [myResponsibilities])
  const canSeeJoinAnswers = useMemo(() =>
    myResponsibilityTitles.includes(RESP_ADMINISTRATION) || myResponsibilityTitles.includes(RESP_ADD_MEMBERS),
  [myResponsibilityTitles])

  // Spaces inherit roles from the parent group
  const roleGroupId = group?.parentId || group?.id

  // Track spaces: members with Manage Spaces, or the Moderator/Host system role, can see who completed the track.
  const trackId = group?.track?.id
  const canManageSpaces = useSelector(state => hasResponsibilityForGroup(state, { groupId: roleGroupId, responsibility: RESP_MANAGE_SPACES }))
  const myRoleNames = useSelector(state => getRolesForGroup(state, { groupId: roleGroupId }).map(role => role.name))
  const canSeeTrackCompletion = Boolean(trackId) && (canManageSpaces || myRoleNames.some(name => TRACK_COMPLETION_VISIBLE_ROLES.includes(name)))
  const currentTrack = useSelector(state => trackId ? getTrack(state, trackId) : null)
  const completedAtByUserId = useMemo(() => {
    if (!canSeeTrackCompletion) return {}
    return Object.fromEntries((currentTrack?.enrolledUsers || []).map(user => [user.id, user.completedAt]))
  }, [canSeeTrackCompletion, currentTrack?.enrolledUsers])

  // Funding round spaces: show who can submit / vote from round role settings
  const fundingRoundId = group?.fundingRound?.id
  const fundingRound = useSelector(state => fundingRoundId ? getFundingRound(state, fundingRoundId) : null)
  const showFundingRoundRoles = Boolean(fundingRoundId)
  const submitterRoles = fundingRound?.submitterRoles || []
  const voterRoles = fundingRound?.voterRoles || []

  const rolesSourceGroup = useSelector(state => {
    if (!group) return null
    const session = orm.session(state.orm)
    if (group.parentId) {
      return session.Group.withId(group.parentId)
    }
    return group
  })

  const filterableRoles = useMemo(() => {
    const roles = (rolesSourceGroup?.groupRoles?.items || []).filter(role => role.active !== false)
    return [
      ...sortSystemGroupRoles(roles),
      ...sortCustomGroupRoles(roles.filter(role => !isSystemGroupRole(role)))
    ]
  }, [rolesSourceGroup])

  const selectedRole = useMemo(
    () => filterableRoles.find(role => String(role.id) === String(groupRoleId)),
    [filterableRoles, groupRoleId]
  )

  useEffect(() => {
    if (trackId) dispatch(fetchTrack(trackId))
  }, [dispatch, trackId])

  useEffect(() => {
    if (fundingRoundId) dispatch(fetchFundingRound(fundingRoundId))
  }, [dispatch, fundingRoundId])

  const [showAnswers, setShowAnswers] = useState(false)

  // One-column menu style shows the member directory as a grid of square cards.
  const isOneColumnLayout = context === 'groups' && resolveIsOneColumnLayout(
    currentUser?.settings?.groupNavStyle,
    group?.settings?.layout
  )

  // Action creators
  const changeSearch = useCallback(term =>
    dispatch(changeQuerystringParam(location, 'q', term)), [location])
  const changeSort = useCallback(sort =>
    dispatch(changeQuerystringParam(location, 's', sort, 'name')), [location, dispatch])
  const changeRoleFilter = useCallback(roleId =>
    dispatch(changeQuerystringParam(location, 'r', roleId, null)), [location, dispatch])
  const removeMemberAction = useCallback((id) => {
    if (!group?.id) return
    // We pass slug and group.id because slug is needed to optimistically update the query results, which are based on slug
    // TODO: ideally switch removeMember to also use slug so we dont need to pass in group.id too
    dispatch(removeMember(id, group.id, slug))
  }, [dispatch, group?.id, slug])
  const fetchMembersAction = useCallback((offset = 0) => {
    if (!group?.id || !slug) return
    dispatch(fetchMembers({ slug, groupId: group.id, sortBy, offset, search, groupRoleId }))
  }, [dispatch, slug, group?.id, sortBy, search, groupRoleId])

  useLayoutEffect(() => {
    const centerColumn = document.getElementById(CENTER_COLUMN_ID)
    if (centerColumn) centerColumn.scrollTop = 0
  }, [slug, sortBy, search, groupRoleId])

  useEffect(() => {
    if (!group?.id || !slug) return
    fetchMembersAction(0)
  }, [group?.id, slug, sortBy, search, groupRoleId, fetchMembersAction])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('Member Directory'),
      icon: '',
      info: '',
      search: true
    })
  }, [t])

  const fetchMore = () => {
    if (pending || members.length === 0 || !hasMore) return
    fetchMembersAction(members.length)
  }

  const debouncedSearch = debounce(300, changeSearch)

  if (!group?.id) {
    return <MembersBootstrapSkeleton />
  }

  return (
    <div className='h-auto max-w-[750px] mx-auto' id='members-page'>
      <Helmet>
        <title>{t('Members')} | {group ? `${group.name} | ` : ''}Hylo</title>
      </Helmet>
      {myResponsibilityTitles.includes(RESP_ADD_MEMBERS) && (
        <div className='flex items-center justify-between p-2'>
          <Link to={groupUrl(slug, 'settings/invite')}>
            <Button
              className={classes.invite}
              color='green-white-green-border'
              narrow
            >
              <Icon name='Invite' className={classes.inviteIcon} /> {t('Invite People')}
            </Button>
          </Link>
        </div>
      )}
      <div className={classes.content}>
        <div className='flex flex-wrap items-center gap-2 py-4'>
          <input
            placeholder={t('Search {{memberCount}} members by name or skills & interests', { memberCount })}
            className='bg-input/60 focus:bg-input/100 rounded-lg text-foreground placeholder-foreground/40 w-full p-2 transition-all outline-none focus:outline-focus focus:outline-2'
            defaultValue={search}
            onChange={e => debouncedSearch(e.target.value)}
          />
          <Dropdown
            id='members-sort-dropdown'
            className='border-2 border-foreground/20 rounded-lg p-2 text-foreground/100'
            toggleChildren={<SortLabel text={sortKeys[sortBy]} />}
            alignRight
            items={Object.keys(sortKeys).map(k => ({
              label: t(sortKeys[k]),
              onClick: () => changeSort(k)
            }))}
          />
          {filterableRoles.length > 0 && (
            <Dropdown
              id='members-role-filter-dropdown'
              className='border-2 border-foreground/20 rounded-lg p-2 text-foreground/100'
              toggleChildren={<RoleFilterLabel role={selectedRole} />}
              alignRight
              items={[
                {
                  label: t('All members'),
                  onClick: () => changeRoleFilter(null)
                },
                ...filterableRoles.map(role => ({
                  label: roleLabel(role),
                  onClick: () => changeRoleFilter(role.id)
                }))
              ]}
            />
          )}
          {canSeeJoinAnswers && (
            <div className='flex items-center gap-2'>
              <SwitchStyled
                checked={showAnswers}
                onChange={() => setShowAnswers(!showAnswers)}
                backgroundColor={showAnswers ? '#0DC39F' : '#8B96A4'}
              />
              <span className='text-sm font-medium text-foreground/80'>{t('Show Answers')}</span>
            </div>
          )}
        </div>
        <div className={isOneColumnLayout ? 'grid grid-cols-2 sm:grid-cols-3 gap-3' : 'flex flex-col gap-2'}>
          {isLoading
            ? <MembersListSkeleton isOneColumnLayout={isOneColumnLayout} />
            : members.map(member => (
              <Member
                group={group}
                removeMember={removeMemberAction}
                member={member}
                key={member.id}
                context={context}
                canSeeJoinAnswers={canSeeJoinAnswers}
                showAnswers={showAnswers}
                showTrackCompletion={canSeeTrackCompletion}
                trackCompletedAt={completedAtByUserId[member.id]}
                showFundingRoundRoles={showFundingRoundRoles}
                submitterRoles={submitterRoles}
                voterRoles={voterRoles}
                square={isOneColumnLayout}
              />
            ))}
        </div>
      </div>
      <ScrollListener
        onBottom={fetchMore}
        elementId='center-column'
      />
    </div>
  )
}

function MembersListSkeleton ({ isOneColumnLayout }) {
  const rows = [0, 1, 2, 3, 4, 5, 6]

  if (isOneColumnLayout) {
    return rows.map(i => (
      <div key={i} className='aspect-square rounded-lg bg-foreground/5 animate-pulse' />
    ))
  }

  return rows.map(i => (
    <div key={i} className='flex items-center gap-3 py-3 border-b border-foreground/5'>
      <div className='w-11 h-11 rounded-full bg-foreground/10 animate-pulse flex-shrink-0' />
      <div className='flex-1 flex flex-col gap-2 min-w-0'>
        <div className='h-3 w-[38%] rounded bg-foreground/10 animate-pulse' />
        <div className='h-2 w-[62%] rounded bg-foreground/10 animate-pulse' />
      </div>
    </div>
  ))
}

function SortLabel ({ text }) {
  const { t } = useTranslation()
  return (
    <div className='flex items-center w-fit gap-1 text-foreground/70 text-sm'>
      <span className='whitespace-nowrap'>{t('Sort by')} <strong>{t(text)}</strong></span>
      <Icon name='ArrowDown' />
    </div>
  )
}

function RoleFilterLabel ({ role }) {
  const { t } = useTranslation()
  const label = role ? roleLabel(role) : t('All members')
  return (
    <div className='flex items-center w-fit gap-1 text-foreground/70 text-sm'>
      <span className='whitespace-nowrap'>{t('Filter by role')}: <strong>{label}</strong></span>
      <Icon name='ArrowDown' />
    </div>
  )
}

function roleLabel (role) {
  return `${role.emoji ? role.emoji + ' ' : ''}${role.name}`.trim()
}

function sortKeysFactory () {
  return {
    name: 'Name',
    location: 'Location',
    join: 'Newest',
    last_active_at: 'Last Active'
  }
}

export default Members
