import React, { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'

import Avatar from 'components/Avatar'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { groupUrl, spaceHomeUrl } from '@hylo/navigation'
import GroupViewPresenter from '@hylo/presenters/GroupViewPresenter'
import fetchGroupRelationships from 'store/actions/fetchGroupRelationships'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import { FETCH_GROUP_RELATIONSHIPS, FETCH_GROUP_SPACES } from 'store/constants'
import { viewAcceptedByPostTypes } from 'store/models/GroupView'
import {
  getChildGroups,
  getParentGroups,
  getPeerGroups
} from 'store/selectors/getGroupRelationships'
import { getMoreSpacesSections } from 'store/selectors/getMoreSpacesSections'
import isPendingFor from 'store/selectors/isPendingFor'

import { menuViewUrl } from './groupViewMenuUrl'

/** Section heading for More Spaces page lists. */
function SectionHeading ({ children }) {
  return (
    <h3 className='text-xs text-foreground/40 uppercase tracking-wide mt-6 mb-2 first:mt-0'>
      {children}
    </h3>
  )
}

/** Icon for a space row. */
function SpaceIcon ({ space }) {
  if (space.avatarUrl) {
    return <Avatar avatarUrl={space.avatarUrl} name={space.name} small />
  }
  if (space.icon) {
    return <LucideIcon name={space.icon} className='h-5 w-5 shrink-0' />
  }
  return <div className='h-5 w-5 shrink-0 rounded-full bg-foreground/15' />
}

/** Clickable space row that opens the space home view. */
function SpaceRow ({ space, onOpen, explainer }) {
  return (
    <button
      type='button'
      onClick={() => onOpen(space)}
      className='flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg border-2 border-transparent hover:border-foreground/30 hover:bg-card transition-all'
    >
      <SpaceIcon space={space} />
      <span className='flex-1 truncate font-medium text-foreground'>{space.name}</span>
      {explainer && (
        <span className='text-xs text-foreground/40 shrink-0'>{explainer}</span>
      )}
    </button>
  )
}

/**
 * Full-page More Spaces list for independent space menu mode (center column).
 * Same sections as the ContextMenu More Spaces expand, including related groups.
 */
export default function MoreSpacesPage ({ group }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { setHeaderDetails } = useViewHeader()
  const groupSlug = group?.slug

  const sections = useSelector(state => getMoreSpacesSections(state, group))
  const parentGroups = useSelector(state => getParentGroups(state, group))
  const childGroups = useSelector(state => getChildGroups(state, group))
  const peerGroups = useSelector(state => getPeerGroups(state, group))
  const pending = useSelector(state =>
    isPendingFor([FETCH_GROUP_SPACES, FETCH_GROUP_RELATIONSHIPS], state)
  )

  useEffect(() => {
    setHeaderDetails({
      title: t('More Spaces'),
      icon: '',
      info: '',
      search: false
    })
  }, [setHeaderDetails, t])

  useEffect(() => {
    if (!group?.id || !groupSlug) return
    dispatch(fetchGroupSpaces(group.id))
    dispatch(fetchGroupRelationships(groupSlug))
  }, [dispatch, group?.id, groupSlug])

  const relatedGroups = useMemo(() => {
    const menuGroupIds = new Set(
      (group?.groupViews?.items || [])
        .filter(view => view.type === 'group' && view.linkedGroup?.id)
        .map(view => String(view.linkedGroup.id))
    )
    return [
      ...parentGroups.map(g => ({ group: g, relationLabel: t('Parent') })),
      ...childGroups.map(g => ({ group: g, relationLabel: t('Child') })),
      ...peerGroups.map(g => ({ group: g, relationLabel: t('Peer') }))
    ]
      .filter(({ group: related }) => !menuGroupIds.has(String(related.id)))
      .sort((a, b) => (a.group.name || '').localeCompare(b.group.name || ''))
  }, [parentGroups, childGroups, peerGroups, group?.groupViews?.items, t])

  const handleOpenSpace = useCallback((space) => {
    const views = (space.groupViews?.items || [])
      .filter(v => v.order != null)
      .filter(v => viewAcceptedByPostTypes(v.type, space.acceptedPostTypes))
    if (views.length === 1) {
      navigate(menuViewUrl(groupSlug, GroupViewPresenter(views[0]), space), {
        state: { fromMoreSpaces: true }
      })
      return
    }
    navigate(spaceHomeUrl(groupSlug, space), { state: { fromMoreSpaces: true } })
  }, [navigate, groupSlug])

  const handleOpenRelated = useCallback((related) => {
    navigate(groupUrl(related.slug))
  }, [navigate])

  const showTracks = sections.trackSpaces.length > 0
  const showFundingRounds = sections.fundingRoundSpaces.length > 0
  const showRelatedGroups = relatedGroups.length > 0
  const showOtherSpaces = sections.otherSpaces.length > 0
  const showArchived = sections.archivedSpaces.length > 0
  const hasContent = showTracks || showFundingRounds || showRelatedGroups || showOtherSpaces || showArchived

  return (
    <div className='w-full max-w-[720px] mx-auto px-4 py-6'>
      {pending && !hasContent
        ? <p className='text-sm text-foreground/40'>{t('Loading…')}</p>
        : !hasContent
          ? <p className='text-sm text-foreground/40'>{t('No more spaces')}</p>
          : (
            <div className='flex flex-col'>
              {showTracks && (
                <section>
                  <SectionHeading>{t('Tracks')}</SectionHeading>
                  {sections.trackSpaces.map(space => (
                    <SpaceRow
                      key={space.id}
                      space={space}
                      onOpen={handleOpenSpace}
                      explainer={space.isDraft ? t('Draft') : null}
                    />
                  ))}
                </section>
              )}
              {showFundingRounds && (
                <section>
                  <SectionHeading>{t('Funding Rounds')}</SectionHeading>
                  {sections.fundingRoundSpaces.map(space => (
                    <SpaceRow key={space.id} space={space} onOpen={handleOpenSpace} />
                  ))}
                </section>
              )}
              {showRelatedGroups && (
                <section>
                  <SectionHeading>{t('Related Groups')}</SectionHeading>
                  {relatedGroups.map(({ group: related, relationLabel }) => (
                    <button
                      key={`${relationLabel}-${related.id}`}
                      type='button'
                      onClick={() => handleOpenRelated(related)}
                      className='flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg border-2 border-transparent hover:border-foreground/30 hover:bg-card transition-all'
                    >
                      <Avatar avatarUrl={related.avatarUrl} name={related.name} small />
                      <span className='flex-1 truncate font-medium text-foreground'>{related.name}</span>
                      <span className='text-xs text-foreground/40 shrink-0'>{relationLabel}</span>
                    </button>
                  ))}
                </section>
              )}
              {showOtherSpaces && (
                <section>
                  <SectionHeading>{t('Spaces')}</SectionHeading>
                  {sections.otherSpaces.map(space => (
                    <SpaceRow key={space.id} space={space} onOpen={handleOpenSpace} />
                  ))}
                </section>
              )}
              {showArchived && (
                <section>
                  <SectionHeading>{t('Archived Spaces')}</SectionHeading>
                  {sections.archivedSpaces.map(space => (
                    <SpaceRow key={space.id} space={space} onOpen={handleOpenSpace} />
                  ))}
                </section>
              )}
            </div>
            )}
    </div>
  )
}
