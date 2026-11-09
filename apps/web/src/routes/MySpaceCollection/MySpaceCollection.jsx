import { BadgeDollarSign, Shapes } from 'lucide-react'
import React, { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { localSpaceSlug, spaceUrl } from '@hylo/navigation'

import { useViewHeader } from 'contexts/ViewHeaderContext'
import fetchMySpaceMemberships from 'store/actions/fetchMySpaceMemberships'
import { FETCH_MY_SPACE_MEMBERSHIPS } from 'store/constants'
import { GROUP_TYPES } from 'store/models/Group'
import getMyMemberships from 'store/selectors/getMyMemberships'
import isPendingFor from 'store/selectors/isPendingFor'
import { cn } from 'util/index'

import { SpaceViewCard } from 'routes/AuthLayoutRouter/components/ContextMenu/GroupViewCard'
import ViewsGridSkeleton from 'routes/AuthLayoutRouter/components/ContextMenu/ViewsGridSkeleton'
import { spaceEntryUrl } from 'routes/AuthLayoutRouter/components/ContextMenu/groupViewMenuUrl'

/**
 * Builds a plain space object for SpaceViewCard from a membership Group model.
 */
function toSpaceCard (group, kind, parentById) {
  const ref = group.ref || group
  const parentGroup = group.parentGroup?.ref || group.parentGroup ||
    parentById[String(ref.parentId)] || null
  return {
    ...ref,
    parentGroup,
    isDraft: ref.status === 'draft'
  }
}

/**
 * Membership spaces of the given kind (track or funding-round), sorted by name.
 */
function spacesFromMemberships (memberships, kind) {
  const parentById = {}
  for (const membership of memberships) {
    const group = membership.group
    if (!group || group.type === GROUP_TYPES.space || group.parentId) continue
    parentById[String(group.id)] = group.ref || group
  }

  return memberships
    .map(membership => membership.group)
    .filter(Boolean)
    .filter(group => group.active !== false)
    .filter(group => group.type === GROUP_TYPES.space || group.parentId)
    .filter(group => kind === 'track' ? group.track : group.fundingRound)
    .map(group => toSpaceCard(group, kind, parentById))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}

/**
 * Card grid of track or funding-round spaces the current user is a member of.
 * Matches the Space Collection layout.
 */
export default function MySpaceCollection ({ kind }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { setHeaderDetails } = useViewHeader()

  const isTrack = kind === 'track'
  const title = isTrack ? t('My Tracks') : t('My Funding Rounds')
  const emptyMessage = isTrack
    ? t('You are not a member of any tracks')
    : t('You are not a member of any funding rounds')

  const memberships = useSelector(getMyMemberships)
  const pending = useSelector(state => isPendingFor(FETCH_MY_SPACE_MEMBERSHIPS, state))
  const spaces = useMemo(() => spacesFromMemberships(memberships, kind), [memberships, kind])
  const hasContent = spaces.length > 0

  useEffect(() => {
    dispatch(fetchMySpaceMemberships())
  }, [dispatch])

  useEffect(() => {
    setHeaderDetails({
      title,
      search: false,
      icon: isTrack ? <Shapes /> : <BadgeDollarSign />
    })
  }, [setHeaderDetails, title, isTrack])

  const handleOpenSpace = useCallback((space) => {
    const parentSlug = space.parentGroup?.slug
    if (!parentSlug) return
    navigate(spaceEntryUrl(parentSlug, space), { state: { fromMySpaces: true } })
  }, [navigate])

  const handleOpenSpaceAbout = useCallback((space) => {
    const parentSlug = space.parentGroup?.slug
    if (!parentSlug) return
    const local = localSpaceSlug(parentSlug, space.slug)
    navigate(spaceUrl(parentSlug, local, '/about'))
  }, [navigate])

  return (
    <div className={cn('w-full max-w-[980px] mx-auto px-4 py-6')} data-testid='my-space-collection'>
      {pending && !hasContent
        ? <ViewsGridSkeleton />
        : !hasContent
            ? <p className='text-sm text-foreground/40'>{emptyMessage}</p>
            : (
              <div className='flex flex-wrap gap-3'>
                {spaces.map(space => (
                  <SpaceViewCard
                    key={space.id}
                    space={space}
                    onOpen={handleOpenSpace}
                    onOpenAbout={handleOpenSpaceAbout}
                  />
                ))}
              </div>
              )}
    </div>
  )
}
