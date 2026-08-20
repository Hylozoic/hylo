import { Users } from 'lucide-react'
import React, { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'

import InviteMembersDialog from 'components/InviteMembersDialog/InviteMembersDialog'
import CurrentlyActivePills, {
  DEFAULT_ACTIVE_MAX,
  isRecentlyActive
} from './CurrentlyActivePills'
import { personUrl } from '@hylo/navigation'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import {
  fetchRecentlyActiveMembers,
  getRecentlyActiveMembers
} from 'routes/Members/Members.store'
import { cn } from 'util/index'

/**
 * Currently-active members widget: overlapping avatars, a count pill that opens
 * the members view, and an invite control for stewards (hover on pointer, always
 * visible on touch). Fetches only `max` people from the API.
 * Pass `stacked` to put the count under the avatar row (one-column cards).
 */
export default function CurrentlyActiveMembers ({
  group,
  parentGroup,
  max = DEFAULT_ACTIVE_MAX,
  membersUrl,
  profileGroupSlug,
  onCountClick,
  showCount = true,
  showInvite = true,
  interactive = true,
  stacked = false,
  className
}) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const slug = group?.slug
  const countSlug = profileGroupSlug || slug

  const fetched = useSelector(state => getRecentlyActiveMembers(state, { slug, first: max }))

  useEffect(() => {
    if (!slug) return
    dispatch(fetchRecentlyActiveMembers({ slug, first: max }))
  }, [dispatch, slug, max])

  // The API already returns the N most recently active people. Filtering that
  // short list by a 15-minute window left the strip empty whenever lastActiveAt
  // was missing or a bit stale. The green dot still uses the live window.
  const activeMembers = useMemo(
    () => (fetched || []).slice(0, max),
    [fetched, max]
  )
  const anyOnline = useMemo(
    () => activeMembers.some(m => isRecentlyActive(m)),
    [activeMembers]
  )

  /**
   * Opens a member profile and closes the mobile drawer so the profile is visible.
   */
  const handlePersonClick = (person) => {
    if (!interactive || !person?.id) return
    dispatch(toggleNavMenu(false))
    navigate(personUrl(person.id, countSlug))
  }

  /**
   * Count pill: custom handler (chat drawer) or the members view URL.
   */
  const handleCountClick = (e) => {
    if (!interactive) {
      e.preventDefault()
      return
    }
    if (onCountClick) {
      e.preventDefault()
      onCountClick()
      return
    }
    dispatch(toggleNavMenu(false))
  }

  if (!group) return null

  const countInner = (
    <>
      <Users className='w-3.5 h-3.5' />
      {group.memberCount != null && <span>{group.memberCount}</span>}
      {anyOnline && <span className='w-[7px] h-[7px] rounded-full bg-green-500' aria-hidden='true' />}
    </>
  )
  const countClass = cn(
    'inline-flex items-center gap-1.5 h-7 pl-2.5 pr-2 rounded-md bg-card/90 backdrop-blur-sm border border-foreground/20 text-foreground text-xs font-semibold transition-all shrink-0',
    interactive && 'hover:border-foreground/40 hover:scale-105 cursor-pointer',
    !interactive && 'cursor-inherit'
  )

  const countEl = showCount
    ? (
        membersUrl && interactive
          ? (
            <Link
              to={membersUrl}
              onClick={handleCountClick}
              className={cn(countClass, !stacked && 'ml-2')}
              aria-label={t('Members')}
            >
              {countInner}
            </Link>
            )
          : (
            <button
              type='button'
              onClick={onCountClick}
              disabled={!interactive}
              className={cn(countClass, !stacked && 'ml-2')}
              aria-label={t('Members')}
            >
              {countInner}
            </button>
            )
      )
    : null

  return (
    <div className={cn(
      'group flex min-w-0 w-full',
      stacked ? 'flex-col items-center gap-1.5' : 'items-center',
      className
    )}
    >
      <div className={cn('min-w-0 overflow-hidden', stacked ? 'w-full flex justify-center' : 'flex-1')}>
        <CurrentlyActivePills
          members={activeMembers}
          max={max}
          onPersonClick={handlePersonClick}
          interactive={interactive}
        />
      </div>
      {countEl}
      {showInvite && interactive && !stacked && (
        <div
          className={cn(
            'shrink-0 overflow-hidden transition-[max-width,margin] duration-200 ease-out',
            'max-w-0',
            '[@media(hover:hover)]:group-hover:max-w-[2rem] [@media(hover:hover)]:group-hover:ml-1',
            '[@media(hover:none)]:max-w-[2rem] [@media(hover:none)]:ml-1',
            '[&:has([data-state=open])]:max-w-[2rem] [&:has([data-state=open])]:ml-1'
          )}
        >
          <InviteMembersDialog
            group={group}
            parentGroup={parentGroup}
            alwaysVisible
            triggerClassName='text-foreground/50 hover:text-foreground'
          />
        </div>
      )}
    </div>
  )
}
