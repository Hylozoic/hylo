import { PUBLIC_CONTEXT_SLUG, MY_CONTEXT_SLUG } from '@hylo/shared'
import ContextWidgetPresenter, { findHomeWidget, getStaticMenuWidgets } from './ContextWidgetPresenter'

// TODO: We will move "t" to a shared instance so it will no longer have to be passed here,
// also see note below about things like currentUser
export default function GroupPresenter (group, { currentUser }) {
  if (!group || group?._presented) return group

  const isContextGroup = isContextGroupSlug(group?.slug)
  const isPublicContext = group?.slug === PUBLIC_CONTEXT_SLUG
  const isMyContext = group?.slug === MY_CONTEXT_SLUG

  return {
    ...group,
    avatarUrl: (isMyContext ? currentUser?.avatarUrl : group?.avatarUrl) || DEFAULT_AVATAR,
    bannerUrl: group?.bannerUrl || DEFAULT_BANNER,

    // Note: Currently this flattens to the QuerySet attribute of ".items"
    // Until more is clear we are not flattening items so that non-presented results (most)
    // from queries work largely the same as presented results (e.g. group?.posts?.items, etc)
    // TODO: We shouldn't bind data that. Resolvers which need data not provided by the queried
    // entity should have get* functions e.g. getContextWidgets (or getContextWidgetsForUser)
    // which then take the required params on the presented result.
    contextWidgets: contextWidgetsResolver(group, currentUser),
    homeWidget: group?.contextWidgets && findHomeWidget(group),

    isContextGroup,
    isPublicContext,
    isMyContext,
    shouldWelcome: shouldWelcomeResolver(group, currentUser),
    // Protection from double presenting
    _presented: true
  }
}

function shouldWelcomeResolver (group, currentUser) {
  if (!group || !currentUser) return false
  if (isContextGroupSlug(group.slug)) return false
  const currentMembership = currentUser?.memberships &&
    currentUser.memberships.find(m => m.group.id === group?.id)

  const { agreementsAcceptedAt, joinQuestionsAnsweredAt, showJoinForm } = currentMembership?.settings || {}

  const numAgreements = group?.agreements?.total || 0

  const agreementsChanged = (!isContextGroupSlug(group?.slug) && numAgreements > 0) &&
    (!agreementsAcceptedAt || agreementsAcceptedAt < group?.settings?.agreementsLastUpdatedAt)

  return ((!isContextGroupSlug(group?.slug) && showJoinForm) || agreementsChanged || (group?.settings?.askJoinQuestions && !joinQuestionsAnsweredAt))
}

function contextWidgetsResolver (group, currentUser) {
  if (isContextGroupSlug(group.slug)) {
    return [
      ...group.contextWidgets.items,
      ...getStaticMenuWidgets({
        isPublicContext: group.slug === PUBLIC_CONTEXT_SLUG,
        isMyContext: group.slug === MY_CONTEXT_SLUG,
        profileUrl: profileUrlResolver(currentUser)
      })
    ]
  }
  return (group?.contextWidgets?.items || []).map(widget => ContextWidgetPresenter(widget))
}

// Until such time as we have navigation helpers in a shared context,
// we'll just use this resolver to get the profile URL for the current user
function profileUrlResolver (currentUser) {
  if (!currentUser) return null
  return `all/members/${currentUser?.id}`
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

// NOTE: The below "static group" representations of the My and Public contexts
// used in Mobile. In Web the same things are currently accomplished within the
// within the related component/s.

const MY_CONTEXT_DATA = {
  id: MY_CONTEXT_SLUG,
  slug: MY_CONTEXT_SLUG,
  // TODO: After Web considerations, may belong in ContextWidgetPresenter#MY_CONTEXT_WIDGETS
  contextWidgets: { items: [{ type: 'home', url: '/my/posts' }] },
  name: 'My Home',
  parentGroups: { items: [], hasMore: false, total: 0 },
  childGroups: { items: [], hasMore: false, total: 0 }
}

const PUBLIC_CONTEXT_DATA = {
  id: PUBLIC_CONTEXT_SLUG,
  slug: PUBLIC_CONTEXT_SLUG,
  iconName: 'Globe',
  name: 'The Commons',
  // TODO: After Web considerations, may belong in ContextWidgetPresenter#PUBLIC_CONTEXT_WIDGETS
  contextWidgets: { items: [{ type: 'home', url: '/public/stream' }] },
  parentGroups: { items: [], hasMore: false, total: 0 },
  childGroups: { items: [], hasMore: false, total: 0 }
}

export const isContextGroupSlug = slug =>
  [PUBLIC_CONTEXT_SLUG, MY_CONTEXT_SLUG].includes(slug)

export function getContextGroup (contextSlug, presenterArgs = {}) {
  if (contextSlug === PUBLIC_CONTEXT_SLUG) return GroupPresenter(PUBLIC_CONTEXT_DATA, presenterArgs)
  if (contextSlug === MY_CONTEXT_SLUG) return GroupPresenter(MY_CONTEXT_DATA, presenterArgs)
  return null
}
