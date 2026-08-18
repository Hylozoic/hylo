import { debounce, get } from 'lodash/fp'
import React, { useEffect, useLayoutEffect, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet'
import { Link, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { isSystemGroupRole, sortCustomGroupRoles, sortSystemGroupRoles } from '@hylo/hooks/groupRoleHelpers'
import { LayoutGrid, List, Search } from 'lucide-react'
import Avatar from 'components/Avatar'
import Button from 'components/Button'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import MasonryGrid from 'components/MasonryGrid/MasonryGrid'
import Member from 'components/Member'
import MemberSkillsGraph from 'components/MemberSkillsGraph'
import ScrollListener from 'components/ScrollListener'
import SwitchStyled from 'components/SwitchStyled'
import { MembersBootstrapSkeleton } from 'components/Skeleton/RouteBootstrapPlaceholders'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { useEffectiveGroupSlug } from 'contexts/SpaceGroupContext'
import usePillRowClamp from 'hooks/usePillRowClamp'
import { RESP_ADD_MEMBERS, RESP_ADMINISTRATION } from 'store/constants'
import { groupUrl, personUrl } from '@hylo/navigation'
import { FETCH_MEMBERS, FETCH_MEMBERS_FOR_GRAPH, fetchMembers, fetchMembersForGraph, fetchRoleMemberCounts, getMembers, getGraphMembers, getHasFetchedGraphMembers, getHasMoreMembers, getHasFetchedMembers, getMemberQueryProps, removeMember } from './Members.store'
import { fetchTrack } from 'store/actions/trackActions'
import { fetchFundingRound } from 'routes/FundingRounds/FundingRounds.store'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import getRolesForGroup from 'store/selectors/getRolesForGroup'
import getTrack from 'store/selectors/getTrack'
import getFundingRound from 'store/selectors/getFundingRound'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import changeQuerystringParam from 'store/actions/changeQuerystringParam'
import getResponsibilitiesForGroup from 'store/selectors/getResponsibilitiesForGroup'
import { cn } from 'util/index'
import { CENTER_COLUMN_ID } from 'util/scrolling'
import orm from 'store/models'

import classes from './Members.module.scss'

const defaultSortBy = 'name'
const RECENTLY_ACTIVE_MS = 15 * 60 * 1000
const MAX_ACTIVE_AVATARS = 8

/** Members whose lastActiveAt falls inside the recently-active window. */
function recentlyActiveMembers (members) {
  const now = Date.now()
  return (members || []).filter(person => {
    if (!person?.lastActiveAt) return false
    return now - new Date(person.lastActiveAt).getTime() < RECENTLY_ACTIVE_MS
  })
}
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
  const graphMembers = useSelector(state => getGraphMembers(state, { slug }))
  const currentlyActiveMembers = useMemo(
    () => recentlyActiveMembers(graphMembers.length > 0 ? graphMembers : members),
    [graphMembers, members]
  )
  const graphPending = useSelector(state => state.pending[FETCH_MEMBERS_FOR_GRAPH])
  const hasFetchedGraphMembers = useSelector(state => getHasFetchedGraphMembers(state, { slug }))
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

  // Track spaces: members with Administration, or the Moderator/Host system role, can see who completed the track.
  const trackId = group?.track?.id
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { groupId: roleGroupId, responsibility: RESP_ADMINISTRATION }))
  const myRoleNames = useSelector(state => getRolesForGroup(state, { groupId: roleGroupId }).map(role => role.name))
  const canSeeTrackCompletion = Boolean(trackId) && (canAdminister || myRoleNames.some(name => TRACK_COMPLETION_VISIBLE_ROLES.includes(name)))
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
    // Roles nobody holds aren't useful filters; undefined counts stay visible
    // so a cache that predates membersTotal doesn't blank the row
    const roles = (rolesSourceGroup?.groupRoles?.items || [])
      .filter(role => role.active !== false && role.membersTotal !== 0)
    return [
      ...sortSystemGroupRoles(roles),
      ...sortCustomGroupRoles(roles.filter(role => !isSystemGroupRole(role)))
    ]
  }, [rolesSourceGroup])

  // Spaces inherit role definitions from the parent, but their membership is
  // their own — the parent-wide membersTotal on each role would advertise
  // people who never joined this space. Fetch in-space counts instead.
  const isSpaceContext = Boolean(group?.parentId)
  const [spaceRoleCounts, setSpaceRoleCounts] = useState(null)
  const roleIdsKey = useMemo(() => filterableRoles.map(r => r.id).join(','), [filterableRoles])
  useEffect(() => {
    if (!isSpaceContext || !slug || !roleIdsKey) return
    let cancelled = false
    dispatch(fetchRoleMemberCounts({ slug, roleIds: roleIdsKey.split(',') })).then(res => {
      if (cancelled) return
      const g = res?.payload?.data?.group || {}
      const counts = {}
      for (const id of roleIdsKey.split(',')) counts[id] = g[`r${id}`]?.total ?? 0
      setSpaceRoleCounts(counts)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [isSpaceContext, slug, roleIdsKey, dispatch])

  // In a space: only offer roles someone here actually holds, with real counts
  const displayedRoles = useMemo(() => {
    if (!isSpaceContext) return filterableRoles
    if (!spaceRoleCounts) return filterableRoles
    return filterableRoles.filter(role => spaceRoleCounts[role.id] > 0)
  }, [isSpaceContext, filterableRoles, spaceRoleCounts])

  useEffect(() => {
    if (trackId) dispatch(fetchTrack(trackId))
  }, [dispatch, trackId])

  useEffect(() => {
    if (fundingRoundId) dispatch(fetchFundingRound(fundingRoundId))
  }, [dispatch, fundingRoundId])

  const [showAnswers, setShowAnswers] = useState(false)
  // Controlled so graph skill clicks can fill the box; typing stays debounced
  const [searchValue, setSearchValue] = useState(search || '')
  // Card grid vs compact list, per the members directory design
  const [displayMode, setDisplayMode] = useState(props.defaultDisplayMode || 'card')
  // Role pills keep to one row behind a More pill until expanded; the count
  // includes the All-members pill since the hook measures container children
  const [rolesExpanded, setRolesExpanded] = useState(false)
  const roleClamp = usePillRowClamp(displayedRoles.length + 1, 1, rolesExpanded)

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

  // The skills graph shows the whole membership, unaffected by directory filters
  useEffect(() => {
    if (!group?.id || !slug) return
    dispatch(fetchMembersForGraph({ slug }))
  }, [dispatch, group?.id, slug])

  const handleGraphSkillClick = useCallback(skillName => {
    setSearchValue(skillName)
    changeSearch(skillName)
  }, [changeSearch])

  const { setHeaderDetails } = useViewHeader()
  const isAboutMembersTab = /\/about\/members/.test(location.pathname)
  const pageTitle = isAboutMembersTab ? t('Members') : t('Active Members')
  useEffect(() => {
    setHeaderDetails({
      title: pageTitle,
      icon: '',
      info: '',
      search: true
    })
  }, [t, pageTitle])

  const fetchMore = () => {
    if (pending || members.length === 0 || !hasMore) return
    fetchMembersAction(members.length)
  }

  const debouncedSearch = debounce(300, changeSearch)

  if (!group?.id) {
    return <MembersBootstrapSkeleton />
  }

  return (
    <div className='h-auto w-full mx-auto max-w-[940px] pb-28' id='members-page'>
      <Helmet>
        <title>{pageTitle} | {group ? `${group.name} | ` : ''}Hylo</title>
      </Helmet>
      {currentlyActiveMembers.length > 0 && (
        <div className='px-4 pt-4'>
          <h3 className='text-sm font-semibold text-foreground/70 mb-2'>{t('Currently Active')}</h3>
          <div className='flex items-center'>
            {currentlyActiveMembers.slice(0, MAX_ACTIVE_AVATARS).map((person, index) => (
              <Avatar
                key={person.id}
                url={personUrl(person.id, slug)}
                avatarUrl={person.avatarUrl}
                medium
                className={cn(index > 0 && '-ml-2', 'ring-2 ring-background rounded-full')}
              />
            ))}
            {currentlyActiveMembers.length > MAX_ACTIVE_AVATARS && (
              <span className='ml-2 text-sm text-foreground/60'>
                +{currentlyActiveMembers.length - MAX_ACTIVE_AVATARS}
              </span>
            )}
          </div>
        </div>
      )}
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
        <MemberSkillsGraph
          members={graphMembers}
          loading={Boolean(graphPending) || !hasFetchedGraphMembers}
          slug={slug}
          onSkillClick={handleGraphSkillClick}
        />
        <div className='flex flex-col gap-2 py-4'>
          <div className='flex flex-wrap items-center gap-2'>
            <div className='relative flex-1 min-w-[220px]'>
              <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none' />
              <input
                placeholder={t('Search name, skill, location, keyword')}
                className='bg-input/60 focus:bg-input/100 border-2 border-foreground/20 rounded-lg text-foreground placeholder-foreground/40 w-full p-2 pl-9 transition-all outline-none focus:outline-focus focus:outline-2'
                value={searchValue}
                onChange={e => {
                  setSearchValue(e.target.value)
                  debouncedSearch(e.target.value)
                }}
              />
            </div>
            <Dropdown
              id='members-sort-dropdown'
              className='border-2 border-foreground/20 rounded-lg p-2 text-foreground/100'
              alignRight
              toggleChildren={
                <div className='flex items-center w-fit gap-1 text-foreground/70 text-sm'>
                  <span className='whitespace-nowrap'>{t('Sort by')} <strong>{t(sortKeys[sortBy])}</strong></span>
                  <Icon name='ArrowDown' />
                </div>
              }
              items={Object.keys(sortKeys).map(k => ({
                label: t(sortKeys[k]),
                onClick: () => changeSort(k)
              }))}
            />
            <div className='flex items-center rounded-lg border-2 border-foreground/20 overflow-hidden' role='group' aria-label={t('Layout')}>
              <button
                type='button'
                onClick={() => setDisplayMode('card')}
                aria-label={t('Cards')}
                title={t('Cards')}
                className={cn('px-2.5 py-[10px] transition-colors', displayMode === 'card' ? 'bg-selected text-foreground' : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5')}
              >
                <LayoutGrid className='w-4 h-4' />
              </button>
              <button
                type='button'
                onClick={() => setDisplayMode('list')}
                aria-label={t('List')}
                title={t('List')}
                className={cn('px-2.5 py-[10px] transition-colors', displayMode === 'list' ? 'bg-selected text-foreground' : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5')}
              >
                <List className='w-4 h-4' />
              </button>
            </div>
          </div>
          {filterableRoles.length > 0 && (
            <div ref={roleClamp.containerRef} className='flex flex-wrap items-center gap-1.5'>
              <RolePill active={!groupRoleId} count={memberCount || null} onClick={() => changeRoleFilter(null)}>
                {t('All members')}
              </RolePill>
              {displayedRoles.map(role => {
                const active = String(role.id) === String(groupRoleId)
                const count = isSpaceContext ? (spaceRoleCounts?.[role.id] ?? null) : (role.membersTotal ?? null)
                return (
                  <RolePill key={role.id} active={active} count={count} onClick={() => changeRoleFilter(active ? null : role.id)}>
                    {roleLabel(role)}
                  </RolePill>
                )
              })}
              {!rolesExpanded && (
                <RolePill onClick={() => setRolesExpanded(true)}>
                  {t('More ({{count}})', { count: displayedRoles.length - Math.max(0, roleClamp.visibleCount - 1) })}
                </RolePill>
              )}
            </div>
          )}
          {canSeeJoinAnswers && (
            <div className='flex items-center gap-2'>
              <SwitchStyled
                checked={showAnswers}
                onChange={() => setShowAnswers(!showAnswers)}
                backgroundColor={showAnswers ? '#0DC39F' : '#8B96A4'}
              />
              <span className='text-sm font-medium text-foreground/80'>{t('Show answers to join questions')}</span>
            </div>
          )}
        </div>
        <MasonryGrid
          enabled={displayMode === 'card'}
          gap={12}
          className={cn(
            displayMode === 'card'
              ? 'grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] items-start gap-x-3'
              : 'flex flex-col rounded-xl bg-card overflow-hidden'
          )}
        >
          {isLoading
            ? <MembersListSkeleton />
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
                layout={displayMode === 'list' ? 'row' : 'card'}
              />
            ))}
        </MasonryGrid>
        {!isLoading && members.length === 0 && (
          <div className='py-12 text-center text-sm text-foreground/60'>
            {t('No results for this search')}
          </div>
        )}
        {!isLoading && members.length > 0 && !search && !groupRoleId && Boolean(memberCount) && (
          <div className='py-4 text-center text-xs text-foreground/50'>
            {t('Showing {{count}} of {{total}} members', { count: Math.min(members.length, memberCount), total: memberCount })}
          </div>
        )}
      </div>
      <ScrollListener
        onBottom={fetchMore}
        elementId='center-column'
      />
    </div>
  )
}

function MembersListSkeleton () {
  const rows = [0, 1, 2, 3, 4, 5, 6]
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

/** Role-filter chip: emoji + name pill, highlighted while its filter is on. */
function RolePill ({ active, onClick, count, children }) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-full border-2 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors',
        active
          ? 'bg-selected border-selected text-foreground'
          : 'border-foreground/20 text-foreground/60 hover:text-foreground hover:border-foreground/40'
      )}
    >
      {children}
      {count != null && (
        <span
          className={cn(
            'ml-1.5 inline-grid place-items-center min-w-[18px] px-1 py-px rounded-full text-[10px] font-bold tabular-nums',
            active ? 'bg-background/60 text-foreground' : 'bg-foreground/10 text-foreground/60'
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function roleLabel (role) {
  return `${role.emoji ? role.emoji + ' ' : ''}${role.name}`.trim()
}

function sortKeysFactory () {
  return {
    name: 'Name',
    location: 'Distance',
    join: 'Join Date',
    last_active_at: 'Last Active'
  }
}

export default Members
