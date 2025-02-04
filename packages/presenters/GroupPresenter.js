import { ALL_GROUPS_CONTEXT_SLUG, PUBLIC_CONTEXT_SLUG, MY_CONTEXT_SLUG } from '@hylo/shared'

export function getContextWidgetsForGroup (group){
  if (!group) return []
  if (isContextGroup(group.slug)){
    return getStaticMenuWidgets({ isPublic: group.slug === PUBLIC_CONTEXT_SLUG, isMyContext: group.slug === MY_CONTEXT_SLUG, isAllContext: group.slug === ALL_GROUPS_CONTEXT_SLUG, profileUrl: '' })
  }
  return group?.contextWidgets.items || []
}

export default function GroupPresenter (group) {
  if (!group) return null
  return {
    ...group,
    activeProjects: group.activeProjects || [],
    agreements: group?.agreements?.items ? group.agreements.items.sort((a, b) => a.order - b.order) : [],
    announcements: group.announcements
      ? group.announcements.map(a => ({
        ...a,
        author: a.creator.name,
        primaryImage: a.attachments.length > 0 ? a.attachments[0].url : false
      }))
      : [],
    // TODO: URQL - convert
    contextWidgets: group?.contextWidgets.items
      ? getContextWidgetsForGroup(group)
      : [],
    customViews: group?.customViews?.items || [],
    // customViews: group.customViews
    //   ? group.customViews.items.map(cv => ({
    //     ...cv,
    //     collection: cv.collection ? presentCollection(cv.collection) : null,
    //     topics: cv.topics.map(topic => presentTopic(topic, {}))
    //   }))
    //   : [],
    groupToGroupJoinQuestions: group?.groupToGroupJoinQuestions || [],
    groupTopics: group?.groupTopics?.items
      ? group.groupTopics.items.map(groupTopic => ({ ...groupTopic, name: groupTopic.topic.name }))
      : [],
    joinQuestions: group.joinQuestions ? group.joinQuestions.items : [],
    members: group.members ? group.members : [],
    stewards: group.stewards ? group.stewards : [],
    openOffersAndRequests: group.openOffersAndRequests || [],
    prerequisiteGroups: group.prerequisiteGroups
      ? group.prerequisiteGroups.items?.map(prereq => ({ ...prereq, joinQuestions: prereq.joinQuestions || [] }))
      : [],
    suggestedSkills: group?.suggestedSkills?.items || [],
    upcomingEvents: group.upcomingEvents
      ? group.upcomingEvents.map(p => ({ ...p, primaryImage: p.attachments.length > 0 ? p.attachments[0].url : false }))
      : [],
    widgets: group.widgets || []
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

export const ALL_GROUP_ID = ALL_GROUPS_CONTEXT_SLUG
export const ALL_GROUP_AVATAR_PATH = '/assets/white-merkaba.png'
export const ALL_GROUP = {
  id: ALL_GROUP_ID,
  slug: ALL_GROUP_ID,
  headerAvatarUrl: 'assets/All_Groups.png',
  avatarUrl: 'assets/All_Groups2.png',
  bannerUrl: 'assets/all-groups-banner.png',
  name: 'All My Groups',
  parentGroups: { items: [], hasMore: false, total: 0 },
  childGroups: { items: [], hasMore: false, total: 0 }
}

export const PUBLIC_GROUP_ID = PUBLIC_CONTEXT_SLUG
export const PUBLIC_GROUP = {
  id: PUBLIC_GROUP_ID,
  slug: PUBLIC_GROUP_ID,
  headerAvatarUrl: 'assets/green-icon.jpg',
  avatarUrl: 'assets/public.png',
  bannerUrl: 'assets/green-hero.jpg',
  name: 'Public Stream',
  parentGroups: { items: [], hasMore: false, total: 0 },
  childGroups: { items: [], hasMore: false, total: 0 }
}

export const MY_CONTEXT_ID = 'my'
export const MY_CONTEXT_AVATAR_PATH = '/assets/my-home.png'
export const MY_CONTEXT_GROUP = {
  id: MY_CONTEXT_ID,
  slug: MY_CONTEXT_ID,
  headerAvatarUrl: 'assets/purple-icon.jpg',
  avatarUrl: 'assets/my-home.png',
  bannerUrl: 'assets/purple-hero.jpg',
  name: 'My Home',
  parentGroups: { items: [], hasMore: false, total: 0 },
  childGroups: { items: [], hasMore: false, total: 0 }
}

export const isContextGroup = slug =>
  [ALL_GROUPS_CONTEXT_SLUG, PUBLIC_CONTEXT_SLUG, MY_CONTEXT_SLUG].includes(slug)

export function getContextGroup (groupSlug, groupId) {
  if (groupId === ALL_GROUP_ID || groupSlug === ALL_GROUP_ID) return ALL_GROUP
  if (groupId === PUBLIC_GROUP_ID || groupSlug === PUBLIC_GROUP_ID) return PUBLIC_GROUP
  if (groupId === MY_CONTEXT_ID || groupSlug === MY_CONTEXT_ID) return MY_CONTEXT_GROUP
  return null
}
