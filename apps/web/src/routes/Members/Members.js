import { debounce, get } from 'lodash/fp'
import React, { useEffect, useLayoutEffect, useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet'
import { useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { isSystemGroupRole, sortCustomGroupRoles, sortSystemGroupRoles } from '@hylo/hooks/groupRoleHelpers'
import { LayoutGrid, List, Search, Waypoints } from 'lucide-react'
import InviteMembersDialog from 'components/InviteMembersDialog/InviteMembersDialog'
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
import { isPhoneDevice } from 'util/mobile'
import { FETCH_MEMBERS, FETCH_MEMBERS_FOR_GRAPH, fetchMembers, fetchMembersForGraph, fetchRoleMemberCounts, fetchFundingRoundMemberCounts, getMembers, getGraphMembers, getHasFetchedGraphMembers, getHasMoreMembers, getHasFetchedMembers, getMemberQueryProps, removeMember } from './Members.store'
import { fetchTrack } from 'store/actions/trackActions'
import { fetchFundingRound } from 'routes/FundingRounds/FundingRounds.store'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import getRolesForGroup from 'store/selectors/getRolesForGroup'
import getTrack from 'store/selectors/getTrack'
import getFundingRound from 'store/selectors/getFundingRound'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import changeQuerystringParam, { changeQuerystringParams } from 'store/actions/changeQuerystringParam'
import getResponsibilitiesForGroup from 'store/selectors/getResponsibilitiesForGroup'
import { cn } from 'util/index'
import { CENTER_COLUMN_ID } from 'util/scrolling'
import orm from 'store/models'

import classes from './Members.module.scss'

const defaultSortBy = 'name'
// TODO: should be by responsibility, not role
const TRACK_COMPLETION_VISIBLE_ROLES = ['Moderator', 'Host']
const FUNDING_ROUND_CAPABILITIES = ['submit', 'notSubmit', 'vote', 'notVote']

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
  const trackCompletedParam = getQuerystringParam('tc', location)
  const trackCompleted = trackCompletedParam === 'completed' ? true : trackCompletedParam === 'not' ? false : null
  const fundingRoundCapabilityParam = getQuerystringParam('fr', location)
  const fundingRoundCapability = FUNDING_ROUND_CAPABILITIES.includes(fundingRoundCapabilityParam) ? fundingRoundCapabilityParam : null
  const memberCount = useSelector(state => get('memberCount', group))
  const memberQueryProps = useMemo(
    () => getMemberQueryProps({ slug, search, sortBy, groupRoleId, trackCompleted, fundingRoundCapability }),
    [slug, search, sortBy, groupRoleId, trackCompleted, fundingRoundCapability]
  )
  const members = useSelector(state => getMembers(state, memberQueryProps))
  const graphMembers = useSelector(state => getGraphMembers(state, { slug }))
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
  const [fundingRoundCounts, setFundingRoundCounts] = useState(null)

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

  useEffect(() => {
    if (!showFundingRoundRoles || !slug) return
    let cancelled = false
    dispatch(fetchFundingRoundMemberCounts({ slug })).then(res => {
      if (cancelled) return
      const g = res?.payload?.data?.group || {}
      setFundingRoundCounts({
        submit: g.canSubmit?.total ?? 0,
        notSubmit: g.notSubmit?.total ?? 0,
        vote: g.canVote?.total ?? 0,
        notVote: g.notVote?.total ?? 0
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [showFundingRoundRoles, slug, dispatch])

  const [showAnswers, setShowAnswers] = useState(false)
  // Controlled so graph skill clicks can fill the box; typing stays debounced
  const [searchValue, setSearchValue] = useState(search || '')
  // Card grid vs compact list, per the members directory design
  const [displayMode, setDisplayMode] = useState(props.defaultDisplayMode || (isPhoneDevice() ? 'list' : 'card'))
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const searchInputRef = useRef(null)
  // Role pills keep to one row behind a More pill until expanded; the count
  // includes the All-members pill since the hook measures container children
  const [rolesExpanded, setRolesExpanded] = useState(false)
  const trackPillCount = canSeeTrackCompletion ? 2 : 0
  const fundingRoundPillCount = showFundingRoundRoles ? 4 : 0
  const roleClamp = usePillRowClamp(displayedRoles.length + 1 + trackPillCount + fundingRoundPillCount, 1, rolesExpanded)
  const completedCount = canSeeTrackCompletion ? (currentTrack?.numPeopleCompleted ?? null) : null
  const notCompletedCount = canSeeTrackCompletion && currentTrack && memberCount != null
    ? Math.max(0, memberCount - (currentTrack.numPeopleCompleted || 0))
    : null

  // Action creators
  const changeSearch = useCallback(term =>
    dispatch(changeQuerystringParam(location, 'q', term)), [location])
  const changeSort = useCallback(sort =>
    dispatch(changeQuerystringParam(location, 's', sort, 'name')), [location, dispatch])
  const changeRoleFilter = useCallback(roleId =>
    dispatch(changeQuerystringParam(location, 'r', roleId, null)), [location, dispatch])
  const changeTrackCompletionFilter = useCallback(value =>
    dispatch(changeQuerystringParam(location, 'tc', value, null)), [location, dispatch])
  const changeFundingRoundCapabilityFilter = useCallback(value =>
    dispatch(changeQuerystringParam(location, 'fr', value, null)), [location, dispatch])
  const clearMemberFilters = useCallback(() => {
    dispatch(changeQuerystringParams(location, { r: null, tc: null, fr: null }))
  }, [location, dispatch])
  const removeMemberAction = useCallback((id) => {
    if (!group?.id) return
    // We pass slug and group.id because slug is needed to optimistically update the query results, which are based on slug
    // TODO: ideally switch removeMember to also use slug so we dont need to pass in group.id too
    dispatch(removeMember(id, group.id, slug))
  }, [dispatch, group?.id, slug])
  const fetchMembersAction = useCallback((offset = 0) => {
    if (!group?.id || !slug) return
    dispatch(fetchMembers({ slug, groupId: group.id, sortBy, offset, search, groupRoleId, trackCompleted, fundingRoundCapability }))
  }, [dispatch, slug, group?.id, sortBy, search, groupRoleId, trackCompleted, fundingRoundCapability])

  useLayoutEffect(() => {
    const centerColumn = document.getElementById(CENTER_COLUMN_ID)
    if (centerColumn) centerColumn.scrollTop = 0
  }, [slug, sortBy, search, groupRoleId, trackCompleted, fundingRoundCapability])

  useEffect(() => {
    if (!group?.id || !slug) return
    fetchMembersAction(0)
  }, [group?.id, slug, sortBy, search, groupRoleId, trackCompleted, fundingRoundCapability, fetchMembersAction])

  // The skill map is loved but heavy — it starts collapsed behind a toggle.
  const [showSkillMap, setShowSkillMap] = useState(false)

  // The skills graph shows the whole membership, unaffected by directory filters.
  // Fetched only once the map is opened — it starts hidden.
  useEffect(() => {
    if (!group?.id || !slug || !showSkillMap) return
    dispatch(fetchMembersForGraph({ slug }))
  }, [dispatch, group?.id, slug, showSkillMap])

  const handleGraphSkillClick = useCallback(skillName => {
    setSearchValue(skillName)
    changeSearch(skillName)
  }, [changeSearch])

  const { setHeaderDetails } = useViewHeader()
  const isAboutMembersTab = /\/about\/members/.test(location.pathname)
  const pageTitle = isAboutMembersTab ? t('Members') : t('Member Directory')
  const canAddMembers = myResponsibilityTitles.includes(RESP_ADD_MEMBERS)
  const inviteParentGroup = group?.parentId ? rolesSourceGroup : null
  useEffect(() => {
    setHeaderDetails({
      title: pageTitle,
      // Canonical members-view icon, same one the group menu uses for this view
      icon: 'Users',
      info: '',
      search: true,
      headerActions: canAddMembers
        ? (
          <InviteMembersDialog
            group={group}
            parentGroup={inviteParentGroup}
            alwaysVisible
            triggerLabel={t('Invite')}
            triggerClassName='rounded-full border px-2 py-0.5 hover:scale-100 bg-foreground/10 border-foreground/20 text-foreground/80 hover:bg-foreground/20 hover:text-foreground dark:bg-white/15 dark:border-white/25 dark:text-white/90 dark:hover:bg-white/25 dark:hover:text-white'
          />
          )
        : null
    })
  }, [t, pageTitle, canAddMembers, group?.id, inviteParentGroup?.id])

  const fetchMore = () => {
    if (pending || members.length === 0 || !hasMore) return
    fetchMembersAction(members.length)
  }

  const debouncedSearch = debounce(300, changeSearch)

  const openMobileSearch = () => {
    setMobileSearchOpen(true)
    // the input only exists once open, so focus on the next tick
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  if (!group?.id) {
    return <MembersBootstrapSkeleton />
  }

  return (
    <div className='h-auto w-full mx-auto max-w-[940px] pb-28' id='members-page'>
      <Helmet>
        <title>{pageTitle} | {group ? `${group.name} | ` : ''}Hylo</title>
      </Helmet>
      <div className={classes.content}>
        <div className='flex flex-col gap-2 py-4'>
          <div className='flex flex-wrap items-center gap-2'>
            {/* Phones start as just a button so the controls fit one row; tapping
                it hands the full row to the input. Desktop is unchanged. */}
            <button
              type='button'
              onClick={openMobileSearch}
              aria-label={t('Search')}
              title={t('Search')}
              data-testid='members-search-button'
              className={cn(
                'sm:hidden shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border-2 border-foreground/20 text-foreground/60 transition-colors hover:text-foreground',
                mobileSearchOpen && 'hidden'
              )}
            >
              <Search className='w-4 h-4' />
            </button>
            <div className={cn(
              'relative sm:flex-1 sm:min-w-[220px]',
              mobileSearchOpen ? 'w-full' : 'hidden sm:block'
            )}
            >
              <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none' />
              <input
                ref={searchInputRef}
                placeholder={t('Search name, skill, location, keyword')}
                className='bg-input/60 focus:bg-input/100 border-2 border-foreground/20 rounded-lg text-foreground placeholder-foreground/40 w-full p-2 pl-9 transition-all outline-none focus:outline-focus focus:outline-2'
                value={searchValue}
                onChange={e => {
                  setSearchValue(e.target.value)
                  debouncedSearch(e.target.value)
                }}
                onBlur={() => { if (!searchValue) setMobileSearchOpen(false) }}
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
            <button
              type='button'
              onClick={() => setShowSkillMap(v => !v)}
              aria-pressed={showSkillMap}
              aria-label={t('Skill map')}
              title={t('Skill map')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border-2 border-foreground/20 px-2.5 py-[10px] text-sm transition-colors',
                showSkillMap ? 'bg-selected text-foreground' : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
              )}
            >
              <Waypoints className='w-4 h-4' />
              <span className='hidden sm:inline whitespace-nowrap'>{t('Skill map')}</span>
            </button>
          </div>
          {(displayedRoles.length > 0 || canSeeTrackCompletion || showFundingRoundRoles) && (
            <div ref={roleClamp.containerRef} className='flex flex-wrap items-center gap-1.5'>
              <RolePill active={!groupRoleId && trackCompleted == null && !fundingRoundCapability} count={memberCount || null} onClick={clearMemberFilters}>
                {t('All members')}
              </RolePill>
              {canSeeTrackCompletion && (
                <>
                  <RolePill
                    active={trackCompleted === true}
                    count={completedCount}
                    onClick={() => changeTrackCompletionFilter(trackCompleted === true ? null : 'completed')}
                  >
                    {t('Completed Track')}
                  </RolePill>
                  <RolePill
                    active={trackCompleted === false}
                    count={notCompletedCount}
                    onClick={() => changeTrackCompletionFilter(trackCompleted === false ? null : 'not')}
                  >
                    {t('Not Completed Track')}
                  </RolePill>
                </>
              )}
              {showFundingRoundRoles && (
                <>
                  <RolePill
                    active={fundingRoundCapability === 'submit'}
                    count={fundingRoundCounts?.submit ?? null}
                    onClick={() => changeFundingRoundCapabilityFilter(fundingRoundCapability === 'submit' ? null : 'submit')}
                  >
                    {t('Can Submit')}
                  </RolePill>
                  <RolePill
                    active={fundingRoundCapability === 'notSubmit'}
                    count={fundingRoundCounts?.notSubmit ?? null}
                    onClick={() => changeFundingRoundCapabilityFilter(fundingRoundCapability === 'notSubmit' ? null : 'notSubmit')}
                  >
                    {t('Cannot Submit')}
                  </RolePill>
                  <RolePill
                    active={fundingRoundCapability === 'vote'}
                    count={fundingRoundCounts?.vote ?? null}
                    onClick={() => changeFundingRoundCapabilityFilter(fundingRoundCapability === 'vote' ? null : 'vote')}
                  >
                    {t('Can Vote')}
                  </RolePill>
                  <RolePill
                    active={fundingRoundCapability === 'notVote'}
                    count={fundingRoundCounts?.notVote ?? null}
                    onClick={() => changeFundingRoundCapabilityFilter(fundingRoundCapability === 'notVote' ? null : 'notVote')}
                  >
                    {t('Cannot Vote')}
                  </RolePill>
                </>
              )}
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
                  {t('More ({{count}})', { count: displayedRoles.length + trackPillCount + fundingRoundPillCount - Math.max(0, roleClamp.visibleCount - 1) })}
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
        {showSkillMap && (
          <div className='pb-4'>
            <MemberSkillsGraph
              members={graphMembers}
              loading={Boolean(graphPending) || !hasFetchedGraphMembers}
              slug={slug}
              onSkillClick={handleGraphSkillClick}
            />
          </div>
        )}
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
        {!isLoading && members.length > 0 && !search && !groupRoleId && trackCompleted == null && !fundingRoundCapability && Boolean(memberCount) && (
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
