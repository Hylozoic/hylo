import { PUBLIC_CONTEXT_SLUG, MY_CONTEXT_SLUG } from '@hylo/shared'
import ContextWidgetPresenter, { findHomeWidget, getStaticMenuWidgets } from './ContextWidgetPresenter'

export default function GroupPresenter (group) {
  if (!group || group?._presented) return group

  return {
    ...group,
    avatarUrl: group?.avatarUrl || DEFAULT_AVATAR,
    bannerUrl: group?.bannerUrl || DEFAULT_BANNER,

    getContextWidgets: getContextWidgetsResolver(group),
    getShouldWelcome: getShouldWelcomeResolver(group),
    homeWidget: group?.contextWidgets && findHomeWidget(group),
    isStaticContext: isStaticContext(group),

    _presented: true
  }
}

const getShouldWelcomeResolver = group => {
  return currentUser => {
    if (!group || !currentUser) return false
    if (isStaticContext(group.slug)) return false
    const currentMembership = currentUser?.memberships &&
      currentUser.memberships.find(m => m.group.id === group?.id)

    const { agreementsAcceptedAt, joinQuestionsAnsweredAt, showJoinForm } = currentMembership?.settings || {}

    const numAgreements = group?.agreements?.total || 0

    const agreementsChanged = (!isStaticContext(group?.slug) && numAgreements > 0) &&
      (!agreementsAcceptedAt || agreementsAcceptedAt < group?.settings?.agreementsLastUpdatedAt)

    return ((!isStaticContext(group?.slug) && showJoinForm) || agreementsChanged || (group?.settings?.askJoinQuestions && !joinQuestionsAnsweredAt))
  }
}

const getContextWidgetsResolver = group => {
  return currentUser => {
    if (isStaticContext(group.slug)) {
      return [
        ...group.contextWidgets.items,
        ...getStaticMenuWidgets({
          isPublicContext: group.slug === PUBLIC_CONTEXT_SLUG,
          isMyContext: group.slug === MY_CONTEXT_SLUG,
          profileUrl: `all/members/${currentUser?.id}`
        })
      ]
    }
    return (group?.contextWidgets?.items || []).map(widget => ContextWidgetPresenter(widget))
  }
}

export const GROUP_ACCESSIBILITY = {
  Closed: 0,
  Restricted: 1,
  Open: 2
}

export const GROUP_TYPES = {
  default: null,
  farm: 'farm'
}

export function accessibilityDescription (a) {
  switch (a) {
    case GROUP_ACCESSIBILITY.Closed:
      return 'This group is invitation only'
    case GROUP_ACCESSIBILITY.Restricted:
      return 'People can apply to join this group and must be approved'
    case GROUP_ACCESSIBILITY.Open:
      return 'Anyone who can see this group can join it'
  }
}

export function accessibilityIcon (a) {
  switch (a) {
    case GROUP_ACCESSIBILITY.Closed:
      return 'Lock'
    case GROUP_ACCESSIBILITY.Restricted:
      return 'Hand'
    case GROUP_ACCESSIBILITY.Open:
      return 'Enter-Door'
  }
}

export const GROUP_VISIBILITY = {
  Hidden: 0,
  Protected: 1,
  Public: 2
}

export function visibilityDescription (v) {
  switch (v) {
    case GROUP_VISIBILITY.Hidden:
      return 'Only members of this group or direct child groups can see it'
    case GROUP_VISIBILITY.Protected:
      return 'Members of parent groups can see this group'
    case GROUP_VISIBILITY.Public:
      return 'Anyone can find and see this group'
  }
}

export function visibilityIcon (v) {
  switch (v) {
    case GROUP_VISIBILITY.Hidden:
      return 'Hidden'
    case GROUP_VISIBILITY.Protected:
      return 'Shield'
    case GROUP_VISIBILITY.Public:
      return 'Public'
  }
}

export const accessibilityString = (accessibility) => {
  return Object.keys(GROUP_ACCESSIBILITY).find(key => GROUP_ACCESSIBILITY[key] === accessibility)
}

export const visibilityString = (visibility) => {
  return Object.keys(GROUP_VISIBILITY).find(key => GROUP_VISIBILITY[key] === visibility)
}

export const LOCATION_PRECISION = {
  precise: 'Display exact location',
  near: 'Display only nearest city and show nearby location on the map',
  region: 'Display only nearest city and don\'t show on the map'
}

export const DEFAULT_BANNER = 'https://d3ngex8q79bk55.cloudfront.net/misc/default_community_banner.jpg'
export const DEFAULT_AVATAR = 'https://d3ngex8q79bk55.cloudfront.net/misc/default_community_avatar.png'

export const isStaticContext = contextOrSlug =>
  [PUBLIC_CONTEXT_SLUG, MY_CONTEXT_SLUG].includes(contextOrSlug?.slug || contextOrSlug)

// NOTE: The below "static context" representations of the My and Public areas are
// used in Mobile. In Web the same things are currently accomplished within the
// within the related component/s.

export const getMyStaticContext = currentUser => {
  return GroupPresenter({
    id: MY_CONTEXT_SLUG,
    slug: MY_CONTEXT_SLUG,
    avatarUrl: currentUser?.avatarUrl,
    // TODO: After Web considerations, may belong in ContextWidgetPresenter#MY_CONTEXT_WIDGETS
    contextWidgets: { items: [{ type: 'home', url: '/my/posts' }] },
    name: 'My Home',
    parentGroups: { items: [], hasMore: false, total: 0 },
    childGroups: { items: [], hasMore: false, total: 0 }
  })
}

export const getPublicStaticContext = () => {
  return GroupPresenter({
    id: PUBLIC_CONTEXT_SLUG,
    slug: PUBLIC_CONTEXT_SLUG,
    iconName: 'Globe',
    name: 'The Commons',
    // TODO: After Web considerations, may belong in ContextWidgetPresenter#PUBLIC_CONTEXT_WIDGETS
    contextWidgets: { items: [{ type: 'home', url: '/public/stream' }] },
    parentGroups: { items: [], hasMore: false, total: 0 },
    childGroups: { items: [], hasMore: false, total: 0 }
  })
}

export function getStaticContext (contextSlug, currentUser) {
  if (contextSlug === MY_CONTEXT_SLUG) return getMyStaticContext(currentUser)
  if (contextSlug === PUBLIC_CONTEXT_SLUG) return getPublicStaticContext(currentUser)
}
