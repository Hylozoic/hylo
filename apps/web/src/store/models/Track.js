import { attr, fk, many, Model } from 'redux-orm'

export class Role extends Model { }
Role.modelName = 'Role'
Role.fields = {
  id: attr(),
  emoji: attr(),
  name: attr()
}

class Track extends Model {
  currentAction () {
    return this.posts.toModelArray().find(post => !post.completedAt)
  }

  toString () {
    return `Track: ${this.name}`
  }
}

export default Track

Track.modelName = 'Track'

Track.fields = {
  actionDescriptor: attr(),
  actionDescriptorPlural: attr(),
  bannerUrl: attr(),
  completionMessage: attr(),
  completionRole: fk('Role', 'tracks'),
  completionRoleType: attr(),
  description: attr(),
  enrolledUsers: many('Person'),
  groups: many('Group'),
  name: attr(),
  numActions: attr(),
  numPeopleCompleted: attr(),
  numPeopleEnrolled: attr(),
  posts: many('Post'),
  publishedAt: attr(),
  welcomeMessage: attr()
}
