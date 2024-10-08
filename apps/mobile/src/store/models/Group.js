import { Image } from 'react-native'
import { attr, many, Model, fk } from 'redux-orm'
import { ALL_GROUPS_CONTEXT_SLUG, PUBLIC_CONTEXT_SLUG } from '@hylo/shared'
import allGroupsBannerImage from 'assets/all-groups-banner.png'
import allGroupsAvatarUrl from 'assets/All_Groups2.png'
import myHomeAvatarUrl from 'assets/my-home.png'
import allGroupshHeaderAvatarUrl from 'assets/All_Groups.png'
import publicGroupAvatarUrl from 'assets/public.png'
import GREEN_HERO_BANNER_PATH from 'assets/green-hero.jpg'
import GREEN_ICON_AVATAR_PATH from 'assets/green-icon.jpg'
import PURPLE_HERO_BANNER_PATH from 'assets/purple-hero.jpg'
import PURPLE_ICON_AVATAR_PATH from 'assets/purple-icon.jpg'

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
  'precise': 'Display exact location',
  'near': 'Display only nearest city and show nearby location on the map',
  'region': 'Display only nearest city and don\'t show on the map'
}

export class GroupSteward extends Model { }
GroupSteward.modelName = 'GroupSteward'
GroupSteward.fields = {
  group: fk('Group', 'groupstewards'),
  moderator: fk('Person', 'groupmoderators')
}

export class GroupJoinQuestion extends Model { }
GroupJoinQuestion.modelName = 'GroupJoinQuestion'
GroupJoinQuestion.fields = {
  id: attr(),
  questionId: attr(),
  text: attr(),
  group: fk('Group')
}

export class GroupToGroupJoinQuestion extends Model { }
GroupToGroupJoinQuestion.modelName = 'GroupToGroupJoinQuestion'
GroupToGroupJoinQuestion.fields = {
  id: attr(),
  questionId: attr(),
  text: attr(),
  group: fk('Group')
}

export class GroupTopic extends Model {}
GroupTopic.modelName = 'GroupTopic'
GroupTopic.fields = {
  group: fk('Group', 'grouptopics'),
  topic: fk('Topic', 'grouptopics')
}

export class GroupRelationship extends Model {}
GroupRelationship.modelName = 'GroupRelationship'
GroupRelationship.fields = {
  parentGroup: fk({ to: 'Group', as: 'parentGroup', relatedName: 'childRelationships' }),
  childGroup: fk({ to: 'Group', as: 'childGroup', relatedName: 'parentRelationships' })
}

export class GroupPrerequisite extends Model {}
GroupPrerequisite.modelName = 'GroupPrerequisite'
GroupPrerequisite.fields = {
  prerequisiteGroup: fk({ to: 'Group', as: 'prerequisiteGroup', relatedName: 'antireqs' }),
  forGroup: fk({ to: 'Group', as: 'forGroup', relatedName: 'prereqs' })
}

class Group extends Model {
  toString () {
    return `Group: ${this.name}`
  }
}

export default Group

Group.modelName = 'Group'

Group.fields = {
  accessibility: attr(),
  activeProjects: many({
    to: 'Post',
    as: 'activeProjects',
    relatedName: 'activeProjectGroups'
  }),
  agreements: many('Agreement'),
  announcements: many({
    to: 'Post',
    as: 'announcements',
    relatedName: 'announcementGroups'
  }),
  childGroups: many({
    to: 'Group',
    relatedName: 'parentGroups',
    through: 'GroupRelationship',
    throughFields: ['childGroup', 'parentGroup']
  }),
  customViews: many('CustomView'),
  streamOrder: attr(),
  geoShape: attr(),
  groupToGroupJoinQuestions: many('GroupToGroupJoinQuestion'),
  id: attr(),
  joinQuestions: many('GroupJoinQuestion'),
  location: attr(),
  locationId: fk({
    to: 'Location',
    as: 'locationObject'
  }),
  members: many('Person'),
  memberCount: attr(),
  stewards: many({
    to: 'Person',
    relatedName: 'moderatedGroups',
    through: 'GroupSteward',
    throughFields: ['group', 'moderator']
  }),
  stewardDescriptor: attr(),
  stewardDescriptorPlural: attr(),
  name: attr(),
  openOffersAndRequests: many({
    to: 'Post',
    as: 'openOffersAndRequests',
    relatedName: 'groupsWithOffersAndRequests'
  }),
  posts: many('Post'),
  postCount: attr(),
  prerequisiteGroups: many({
    to: 'Group',
    relatedName: 'antirequisiteGroups',
    through: 'GroupPrerequisite',
    throughFields: [ 'prerequisiteGroup', 'forGroup' ]
  }),
  settings: attr(),
  slug: attr(),
  suggestedSkills: many('Skill'),
  upcomingEvents: many({
    to: 'Post',
    as: 'upcomingEvents',
    relatedName: 'eventGroups'
  }),
  visibility: attr(),
  widgets: many('Widget')
}

export const DEFAULT_BANNER = 'https://d3ngex8q79bk55.cloudfront.net/misc/default_community_banner.jpg'
export const DEFAULT_AVATAR = 'https://d3ngex8q79bk55.cloudfront.net/misc/default_community_avatar.png'
export const ALL_GROUP_ID = ALL_GROUPS_CONTEXT_SLUG
export const ALL_GROUP_AVATAR_PATH = '/assets/white-merkaba.png'
export const ALL_GROUP = {
  id: ALL_GROUP_ID,
  slug: ALL_GROUP_ID,
  headerAvatarUrl: Image.resolveAssetSource(allGroupshHeaderAvatarUrl).uri,
  avatarUrl: Image.resolveAssetSource(allGroupsAvatarUrl).uri,
  bannerUrl: Image.resolveAssetSource(allGroupsBannerImage).uri,
  name: 'All My Groups',
  parentGroups: { toModelArray: () => [] },
  childGroups: { toModelArray: () => [] }
}

export const PUBLIC_GROUP_ID = PUBLIC_CONTEXT_SLUG
export const PUBLIC_GROUP = {
  id: PUBLIC_GROUP_ID,
  slug: PUBLIC_GROUP_ID,
  headerAvatarUrl: Image.resolveAssetSource(GREEN_ICON_AVATAR_PATH).uri,
  avatarUrl: Image.resolveAssetSource(publicGroupAvatarUrl).uri,
  bannerUrl: Image.resolveAssetSource(GREEN_HERO_BANNER_PATH).uri,
  name: 'Public Stream',
  parentGroups: { toModelArray: () => [] },
  childGroups: { toModelArray: () => [] }
}

export const MY_CONTEXT_ID = 'my'
export const MY_CONTEXT_AVATAR_PATH = '/assets/my-home.png'
export const MY_CONTEXT_GROUP = {
  id: MY_CONTEXT_ID,
  slug: MY_CONTEXT_ID,
  headerAvatarUrl: Image.resolveAssetSource(PURPLE_ICON_AVATAR_PATH).uri,
  avatarUrl: Image.resolveAssetSource(myHomeAvatarUrl).uri,
  bannerUrl: Image.resolveAssetSource(PURPLE_HERO_BANNER_PATH).uri,
  name: 'My Home',
  parentGroups: { toModelArray: () => [] },
  childGroups: { toModelArray: () => [] }
}

// Move into hylo-shared (PathsHelper?)
export const isContextGroup = slug =>
  [ALL_GROUPS_CONTEXT_SLUG, PUBLIC_CONTEXT_SLUG].includes(slug)
