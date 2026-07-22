import { attr, fk, many, Model } from 'redux-orm'

export class Role extends Model { }
Role.modelName = 'Role'
Role.fields = {
  id: attr(),
  emoji: attr(),
  name: attr(),
  groupId: attr()
}

class Track extends Model {
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
  description: attr(),
  enrolledUsers: many('Person'),
  name: attr(),
  numActions: attr(),
  numPeopleCompleted: attr(),
  numPeopleEnrolled: attr(),
  publishedAt: attr(),
  // Embedded space Group (tracks.group_id) — not a normalized relation
  space: attr(),
  welcomeMessage: attr()
}
