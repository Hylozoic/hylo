import { attr, many, Model, fk } from 'redux-orm'

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
    throughFields: ['prerequisiteGroup', 'forGroup']
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
